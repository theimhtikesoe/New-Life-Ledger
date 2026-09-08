import { PDFDocument } from "pdf-lib";
import chromium from "@sparticuz/chromium-min";
import { chromium as playwright } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { ensureDatabase } from "@/lib/database";
import { getMyanmarDayRange } from "@/lib/myanmar-time";
import { cashSaleTypeLabel, normalizeCashSaleType, summarizeCashSalesByType } from "@/lib/cash-sale-utils";
import { accountingAuditLogWhere, isEditActivity, isOrderWorkflowActivity, isProductionReportSubmitActivity, isProductionWorkerCreateActivity } from "@/lib/accounting-activity";
import { getPaymentSplit, paymentSplitLabel } from "@/lib/payment-split";
import { getBottleDisplayName } from "@/lib/production-catalog";

const MYANMAR_OFFSET_MS = (6 * 60 + 30) * 60 * 1000;
const REMOTE_CHROMIUM_PACK_URL = "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";
const MYANMAR_TIME_ZONE = "Asia/Yangon";

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function amount(value) {
  return `${Number(value || 0).toLocaleString("en-US")} Ks`;
}

const PAYMENT_METHOD_LABELS = {
  CASH: "ငွေသား (Cash)",
  KPAY: "KPay",
  BANK: "ဘဏ်ငွေလွှဲ (Bank)",
  WAVE: "Wave",
  SPECIAL: "အခြားငွေချေမှု",
};

function paymentMethodLabel(value) {
  const key = String(value || "").trim().toUpperCase();
  return PAYMENT_METHOD_LABELS[key] || String(value || "မသတ်မှတ်ရသေး");
}

function formatMyanmarDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MYANMAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getMyanmarDateParts(date) {
  const local = new Date(date.getTime() + MYANMAR_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
  };
}

export function getPreviousMyanmarDayRange(now = new Date()) {
  const current = getMyanmarDateParts(now);
  const previousLocalDay = new Date(Date.UTC(current.year, current.month, current.day - 1));
  const year = previousLocalDay.getUTCFullYear();
  const month = previousLocalDay.getUTCMonth();
  const day = previousLocalDay.getUTCDate();
  const dateLabel = `${year}-${pad(month + 1)}-${pad(day)}`;
  return getMyanmarDayRange(dateLabel);
}

function summarizeLedgers(ledgers) {
  const summary = {
    paidCount: 0,
    paidAmount: 0,
    debtCount: 0,
    debtAmount: 0,
    cashCount: 0,
    cashAmount: 0,
    totalTransactions: ledgers.length,
    paymentTypes: {},
    cashPaymentTypes: {},
  };
  const customers = new Map();

  for (const ledger of ledgers) {
    const isPaid = ledger.type === "DEBIT";
    if (isPaid) {
      summary.paidCount += 1;
      summary.paidAmount += ledger.amount;
    } else {
      summary.debtCount += 1;
      summary.debtAmount += ledger.amount;
    }
    if (isPaid) {
      const paymentType = ledger.paymentType || "မသတ်မှတ်ရသေး";
      summary.paymentTypes[paymentType] = (summary.paymentTypes[paymentType] || 0) + ledger.amount;
    }

    const customerId = ledger.customer.id;
    const current = customers.get(customerId) || {
      customerId,
      customerName: ledger.customer.name,
      paidCount: 0,
      paidAmount: 0,
      debtCount: 0,
      debtAmount: 0,
      cashCount: 0,
      cashAmount: 0,
      cashRetailCount: 0,
      cashRetailAmount: 0,
      cashWholesaleCount: 0,
      cashWholesaleAmount: 0,
    };
    if (isPaid) {
      current.paidCount += 1;
      current.paidAmount += ledger.amount;
    } else {
      current.debtCount += 1;
      current.debtAmount += ledger.amount;
    }
    customers.set(customerId, current);
  }

  return {
    summary,
    customers: Array.from(customers.values()).sort(
      (a, b) => b.paidAmount + b.debtAmount - (a.paidAmount + a.debtAmount),
    ),
  };
}

function summarizeDailySalesRows(cashSales = [], ledgers = []) {
  const result = { retailTotal: 0, wholesaleTotal: 0, retailCash: 0, wholesaleCash: 0, paymentTypes: {} };
  for (const sale of cashSales) {
    const saleAmount = Number(sale.amount || 0);
    const split = getPaymentSplit(sale);
    const saleType = normalizeCashSaleType(sale.saleType);
    if (saleType === "WHOLESALE") {
      result.wholesaleTotal += saleAmount;
      result.wholesaleCash += Number(split.CASH || 0);
    } else {
      result.retailTotal += saleAmount;
      result.retailCash += Number(split.CASH || 0);
    }
    for (const [type, value] of Object.entries(split)) result.paymentTypes[type] = (result.paymentTypes[type] || 0) + Number(value || 0);
  }
  for (const ledger of ledgers) {
    if (String(ledger.type || "").toUpperCase() !== "DEBIT") continue;
    const ledgerAmount = Number(ledger.amount || 0);
    const split = getPaymentSplit(ledger);
    result.wholesaleTotal += ledgerAmount;
    result.wholesaleCash += Number(split.CASH || 0);
    for (const [type, value] of Object.entries(split)) result.paymentTypes[type] = (result.paymentTypes[type] || 0) + Number(value || 0);
  }
  return {
    ...result,
    dailyTotal: result.retailTotal + result.wholesaleTotal,
    cashDailyTotal: result.retailCash + result.wholesaleCash,
  };
}

function summarizeProductionReports(rows = []) {
  const bottles = new Map();
  const tubes = new Map();
  let totalOutput = 0;
  let totalWaste = 0;
  let totalTubeDamage = 0;
  let tubeQuantityValue = "0";
  let tubeQuantityUnit = "အိတ်";
  for (const row of rows) {
    const quantity = Number(row.outputQuantity || 0);
    const capacity = Number(row.outputCapacity || 0);
    const pieces = quantity * capacity;
    if (row.category === "tube") {
      const label = `${row.tubeG || "Tube"} ${row.tubeColor || ""}`.trim();
      const key = `${label}|${capacity}`;
      const current = tubes.get(key) || { label, capacity, quantity: 0, pieces: 0, unit: row.outputUnit || "အိတ်" };
      current.quantity += quantity;
      current.pieces += pieces;
      tubes.set(key, current);
    } else {
      const label = getBottleDisplayName(row.bottleType) || "ဗူးအမျိုးအစား မသတ်မှတ်ရသေးပါ";
      const key = `${label}|${capacity}`;
      const current = bottles.get(key) || { label, capacity, quantity: 0, pieces: 0, unit: row.outputUnit || "ကဒ်" };
      current.quantity += quantity;
      current.pieces += pieces;
      bottles.set(key, current);
      totalOutput += pieces;
    }
    totalWaste = Math.max(totalWaste, Number(row.wasteQuantity || 0));
    totalTubeDamage = Math.max(totalTubeDamage, Number(row.tubeDamageQuantity || 0));
    if (Number(row.tubeQuantity || 0) || String(row.tubeQuantityValue || "0") !== "0") {
      tubeQuantityValue = String(row.tubeQuantityValue ?? row.tubeQuantity ?? 0);
      tubeQuantityUnit = row.tubeQuantityUnit || "အိတ်";
    }
  }
  return { bottles: [...bottles.values()], tubes: [...tubes.values()], totalOutput, totalWaste, totalTubeDamage, tubeQuantityValue, tubeQuantityUnit };
}

export async function getDailySalesSummaryCardData(dateLabel) {
  const { start, end } = getMyanmarDayRange(dateLabel);
  const month = dateLabel.slice(0, 7);
  const monthStart = getMyanmarDayRange(`${month}-01`).start;
  await ensureDatabase();
  const [cashSales, ledgers, opening] = await Promise.all([
    prisma.cashSale.findMany({
      where: { date: { gte: monthStart, lt: end } },
      select: { date: true, amount: true, saleType: true, paymentType: true, paymentBreakdown: true, note: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.ledger.findMany({
      where: { date: { gte: monthStart, lt: end } },
      select: { date: true, amount: true, type: true, paymentType: true, note: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.dailySalesOpening?.findUnique ? prisma.dailySalesOpening.findUnique({ where: { month } }) : Promise.resolve(null),
  ]);
  const cashByDate = new Map();
  const ledgerByDate = new Map();
  for (const sale of cashSales) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: MYANMAR_TIME_ZONE }).format(new Date(sale.date));
    cashByDate.set(key, [...(cashByDate.get(key) || []), sale]);
  }
  for (const ledger of ledgers) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: MYANMAR_TIME_ZONE }).format(new Date(ledger.date));
    ledgerByDate.set(key, [...(ledgerByDate.get(key) || []), ledger]);
  }
  const dates = [...new Set([...cashByDate.keys(), ...ledgerByDate.keys()])].sort();
  const rows = dates.map((date) => ({ date, ...summarizeDailySalesRows(cashByDate.get(date) || [], ledgerByDate.get(date) || []) }));
  const openingAmount = Number(opening?.amount || 0);
  const openingAsOfDate = opening?.asOfDate || "";
  const monthlyTotal = openingAmount + rows.filter((row) => (!openingAsOfDate || row.date > openingAsOfDate) && row.date <= dateLabel).reduce((sum, row) => sum + row.dailyTotal, 0);
  const current = rows.find((row) => row.date === dateLabel) || summarizeDailySalesRows([], []);
  return { dateLabel, opening: openingAmount, ...current, monthlyTotal };
}

export async function getDailyReportData({ start, end, dateLabel } = getPreviousMyanmarDayRange()) {
  await ensureDatabase();
  const [ledgers, cashSales, allAuditLogs, dailySalesSummary, productionReports] = await Promise.all([
    prisma.ledger.findMany({
      where: { date: { gte: start, lt: end } },
      select: {
        id: true,
        date: true,
        createdAt: true,
        type: true,
        saleType: true,
        itemSize: true,
        cartons: true,
        rate: true,
        deductions: true,
        amount: true,
        note: true,
        paymentType: true,
        saleItems: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.cashSale.findMany({
      where: { date: { gte: start, lt: end } },
      select: {
        id: true,
        date: true,
        saleType: true,
        amount: true,
        paymentType: true,
        paymentBreakdown: true,
        saleItems: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.auditLog.findMany({
      where: {
        AND: [
          { createdAt: { gte: start, lt: end } },
          { NOT: { action: { in: ["DAILY_REPORT_SENT", "PRICE_SETTINGS_UPDATE"] } } },
          accountingAuditLogWhere(),
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.dailySalesSummary?.findUnique
      ? prisma.dailySalesSummary.findUnique({
          where: { date: dateLabel },
          select: {
            id: true,
            date: true,
            retailTotal: true,
            wholesaleTotal: true,
            retailCash: true,
            wholesaleCash: true,
            source: true,
            note: true,
            enteredAt: true,
            enteredBy: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : Promise.resolve(null),
    prisma.productionReport?.findMany
      ? prisma.productionReport.findMany({
          where: { reportDate: dateLabel },
          select: { category: true, outputQuantity: true, outputCapacity: true, outputUnit: true, bottleType: true, tubeG: true, tubeColor: true, wasteQuantity: true, tubeDamageQuantity: true, tubeQuantity: true, tubeQuantityValue: true, tubeQuantityUnit: true },
          orderBy: [{ id: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const auditLogs = allAuditLogs.filter((log) => !log.hiddenAt && !isOrderWorkflowActivity(log) && !isEditActivity(log) && !isProductionReportSubmitActivity(log) && !isProductionWorkerCreateActivity(log));
  const { summary, customers: ledgerCustomers } = summarizeLedgers(ledgers);
  summary.cashCount = cashSales.length;
  summary.cashAmount = cashSales.reduce((total, sale) => total + Number(sale.amount || 0), 0);
  summary.cashPaymentTypes = {};
  summary.cashSaleTypes = summarizeCashSalesByType(cashSales);
  const customerMap = new Map(ledgerCustomers.map((customer) => [customer.customerId, customer]));
  for (const cashSale of cashSales) {
    const current = customerMap.get(cashSale.customer.id) || {
      customerId: cashSale.customer.id,
      customerName: cashSale.customer.name,
      paidCount: 0,
      paidAmount: 0,
      debtCount: 0,
      debtAmount: 0,
      cashCount: 0,
      cashAmount: 0,
      cashRetailCount: 0,
      cashRetailAmount: 0,
      cashWholesaleCount: 0,
      cashWholesaleAmount: 0,
    };
    const saleType = normalizeCashSaleType(cashSale.saleType);
    const cashAmount = Number(cashSale.amount || 0);
    current.cashCount += 1;
    current.cashAmount += cashAmount;
    if (saleType === "WHOLESALE") {
      current.cashWholesaleCount += 1;
      current.cashWholesaleAmount += cashAmount;
    } else {
      current.cashRetailCount += 1;
      current.cashRetailAmount += cashAmount;
    }
    for (const [paymentType, paymentAmount] of Object.entries(getPaymentSplit(cashSale))) {
      if (paymentAmount > 0) summary.cashPaymentTypes[paymentType] = (summary.cashPaymentTypes[paymentType] || 0) + paymentAmount;
    }
    customerMap.set(cashSale.customer.id, current);
  }
  const customers = Array.from(customerMap.values()).sort((a, b) =>
    b.paidAmount + b.debtAmount + b.cashAmount - (a.paidAmount + a.debtAmount + a.cashAmount),
  );
  const auditedLedgerIds = new Set(
    allAuditLogs
      .filter((log) => log.entityType === "Ledger" && log.entityId)
      .map((log) => String(log.entityId)),
  );
  const auditedCashSaleIds = new Set(
    allAuditLogs
      .filter((log) => log.entityType === "CashSale" && log.entityId)
      .map((log) => String(log.entityId)),
  );
  const legacyLogs = ledgers.filter((ledger) => !auditedLedgerIds.has(String(ledger.id))).map((ledger) => ({
    id: `legacy-${ledger.id}`,
    actorName: "",
    action: ledger.type === "DEBIT" ? "PAYMENT" : "DEBT_INCREASE",
    entityType: "Ledger",
    entityLabel: ledger.customer.name,
    summary: `${ledger.customer.name} ${ledger.type === "DEBIT" ? "ငွေချေ" : "အကြွေးတိုး"} ${ledger.amount.toLocaleString()} Ks`,
    createdAt: ledger.date,
    eventSource: "legacy",
    metadata: {
      amount: ledger.amount,
      paymentType: ledger.paymentType,
      note: ledger.note,
    },
  }));
  const legacyCashLogs = cashSales.filter((sale) => !auditedCashSaleIds.has(String(sale.id))).map((sale) => ({
    id: `legacy-cash-sale-${sale.id}`,
    actorName: "",
    action: "CASH_SALE",
    entityType: "CashSale",
    entityLabel: sale.customer.name,
    summary: `${sale.customer.name} လက်ငင်းရောင်း ${sale.amount.toLocaleString()} Ks`,
    createdAt: sale.date,
    eventSource: "legacy",
    metadata: {
      amount: sale.amount,
      paymentType: sale.paymentType || "CASH",
      paymentBreakdown: sale.paymentBreakdown || null,
      saleType: normalizeCashSaleType(sale.saleType),
      note: sale.note,
    },
  }));
  const activityLogs = [...auditLogs.map((log) => ({ ...log, eventSource: "audit" })), ...legacyLogs, ...legacyCashLogs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return {
    dateLabel,
    periodLabel: `${dateLabel} 00:00–23:59 (Myanmar time)`,
    start,
    end,
    summary: { ...summary, auditCount: auditLogs.length, activityCount: activityLogs.length },
    customers,
    ledgers,
    cashSales,
    auditLogs,
    activityLogs,
    dailySalesSummary,
    productionReports,
    productionSummary: summarizeProductionReports(productionReports),
  };
}


function summarizeBottleSalesForReport(rows = []) {
  const customers = new Map();
  for (const row of rows) {
    if (!Array.isArray(row.saleItems) || !row.saleItems.length) continue;
    const customer = row.customer || { id: "unknown", name: "Unknown" };
    const current = customers.get(customer.id) || { customer, transactions: 0, totalPaidAmount: 0, items: new Map() };
    current.transactions += 1;
    current.totalPaidAmount += Math.max(0, Math.round(Number(row.amount || 0)));
    for (const item of row.saleItems) {
      const key = String(item.productKey || `${item.productName || "ဗူး"}::${item.capacity || 0}`);
      const entry = current.items.get(key) || { productName: item.productName || "ဗူး", capacity: Number(item.capacity || 0), cardCount: 0, bottleCount: 0, totalAmount: 0 };
      entry.cardCount += Math.max(0, Math.round(Number(item.cardCount || 0)));
      entry.bottleCount += Math.max(0, Math.round(Number(item.bottleCount || 0)));
      entry.totalAmount += Math.max(0, Math.round(Number(item.totalAmount || 0)));
      current.items.set(key, entry);
    }
    customers.set(customer.id, current);
  }
  return [...customers.values()].map((entry) => {
    const items = [...entry.items.values()];
    const totalCards = items.reduce((sum, item) => sum + item.cardCount, 0);
    const totalBottles = items.reduce((sum, item) => sum + item.bottleCount, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
    return { ...entry, items, totalCards, totalBottles, totalAmount, difference: totalAmount - entry.totalPaidAmount };
  }).filter((entry) => entry.totalBottles > 0).sort((a, b) => b.totalBottles - a.totalBottles);
}

function createBottleSalesSummaryHtml(report, fontDataUri, latinDataUri) {
  const esc = escapeXml;
  const sections = [
    ["ငွေချေထားသော ဗူးများ", "အကြွေးစာရင်းမှ ပြန်လည်ငွေချေထားသော ဗူးရောင်းစာရင်း", "paid", summarizeBottleSalesForReport(report.ledgers.filter((row) => row.type === "DEBIT"))],
    ["လက်ငင်းချေထားသော ဗူးများ", "လက်ငင်းရောင်းစာရင်းထဲမှ ဗူးရောင်းအား", "cash", summarizeBottleSalesForReport(report.cashSales)],
    ["အကြွေးတိုးထားသော ဗူးများ", "အကြွေးစာရင်းအဖြစ် သီးခြားမှတ်ထားသော ဗူးရောင်းစာရင်း", "credit", summarizeBottleSalesForReport(report.ledgers.filter((row) => row.type === "CREDIT"))],
  ];
  const sectionHtml = sections.map(([title, subtitle, tone, customers]) => {
    if (!customers.length) return "";
    const rows = customers.map((customer) => {
      const itemRows = customer.items.map((item) => `<tr><td>${esc(customer.customer.name)}</td><td>${esc(item.productName)}</td><td>${item.capacity} ဆံ့/ကဒ်</td><td>${item.cardCount.toLocaleString()}</td><td>${item.bottleCount.toLocaleString()}</td><td>${esc(amount(item.totalAmount))}</td><td>${tone === "credit" ? "—" : esc(amount(customer.totalPaidAmount))}</td><td>${tone === "credit" ? "—" : esc(amount(Math.abs(customer.difference)))}</td></tr>`).join("");
      return itemRows;
    }).join("");
    return `<section class="bottle-section ${tone}"><h2>${esc(title)}</h2><p class="subtitle">${esc(subtitle)}</p><table><thead><tr><th>Customer</th><th>Item</th><th>ဆံ့/ကဒ်</th><th>ကဒ်</th><th>ဗူး</th><th>သတ်မှတ်ငွေ</th><th>တကယ်ရှင်းငွေ</th><th>ကွာဟချက်</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:Padauk;src:url(data:font/ttf;base64,${fontDataUri})}@font-face{font-family:DejaVu;src:url(data:font/ttf;base64,${latinDataUri})}*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a;font-family:Padauk,DejaVu,sans-serif}.sheet{width:1400px;padding:34px;background:#fff;border:1px solid #cbd5e1;border-radius:28px}.brand{font-family:DejaVu,Padauk,sans-serif;font-size:18px;letter-spacing:2px;color:#4338ca;font-weight:700}.title{font-size:38px;font-weight:700;margin-top:6px}.date{font-family:DejaVu,Padauk,sans-serif;font-size:21px;color:#475569;margin-top:6px}.rule{height:2px;background:#e2e8f0;margin:24px 0}.bottle-section{margin-top:22px;padding:20px;border-radius:18px;border:1px solid #cbd5e1}.bottle-section h2{margin:0;font-size:28px}.bottle-section .subtitle{margin:5px 0 12px;color:#475569;font-size:17px}.bottle-section.paid{background:#ecfdf5;border-color:#a7f3d0}.bottle-section.cash{background:#ecfeff;border-color:#a5f3fc}.bottle-section.credit{background:#f5f3ff;border-color:#ddd6fe}.bottle-section table{width:100%;border-collapse:collapse;background:#fff;font-size:18px}.bottle-section th,.bottle-section td{padding:10px 9px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}.bottle-section th:nth-child(n+3),.bottle-section td:nth-child(n+3){text-align:right}.bottle-section th{background:#f8fafc;color:#475569}.paid h2{color:#047857}.cash h2{color:#0e7490}.credit h2{color:#6d28d9}</style></head><body><section id="bottle-sales-summary" class="sheet"><div class="brand">NEW LIFE LEDGER</div><div class="title">တစ်နေ့တာ ဗူးရောင်းစာရင်း</div><div class="date">စာရင်းရက် — ${esc(formatReportDateLabel(report.dateLabel))}</div><div class="rule"></div>${sectionHtml || '<p>ဒီနေ့ ဗူးရောင်းစာရင်း မရှိသေးပါ။</p>'}</section></body></html>`;
}

function resolveFontPath() {
  const bundled = path.join(process.cwd(), "assets", "Padauk-Regular.ttf");
  return fs.existsSync(bundled) ? bundled : null;
}

function resolveLatinFontPath() {
  const bundled = path.join(process.cwd(), "assets", "DejaVuSans.ttf");
  return fs.existsSync(bundled) ? bundled : null;
}

function activityToneClass(action) {
  if (action === "PAYMENT") return "activity-row-payment";
  if (action === "DEBT_INCREASE") return "activity-row-debt";
  if (action === "CASH_SALE") return "activity-row-cash";
  return "activity-row-neutral";
}

function actionLabel(action) {
  return ({ PAYMENT: "ငွေချေ", DEBT_INCREASE: "အကြွေးတိုး", CASH_SALE: "လက်ငင်းရောင်း", CREATE: "အသစ်ထည့်", UPDATE: "ပြင်ဆင်", RESTORE: "ပြန်ယူ", DELETE: "ဖျက်", PERMANENT_DELETE: "အပြီးဖျက်", })[action] || action;
}

function clipText(value, maxLength) {
  const text = String(value ?? "");
  const chars = Array.from(text);
  return chars.length > maxLength ? `${chars.slice(0, maxLength - 1).join("")}…` : text;
}

export function formatCashSaleDetails(customer = {}) {
  return [
    customer.cashRetailCount ? `လက်လီ ${customer.cashRetailCount} / ${amount(customer.cashRetailAmount)}` : null,
    customer.cashWholesaleCount ? `လက်ကား ${customer.cashWholesaleCount} / ${amount(customer.cashWholesaleAmount)}` : null,
  ].filter(Boolean).join("<br>");
}

export function createReportHtml(report, fontDataUri, latinDataUri) {
  const { summary } = report;
  const customers = report.customers || [];
  const logs = report.activityLogs || report.auditLogs || [];
  const esc = escapeXml;
  const customerRows = customers.map((customer) => {
    const cashTypeDetails = formatCashSaleDetails(customer);
    return `<tr><td>${esc(customer.customerName)}</td><td class="green summary-amount">${customer.paidCount} / ${esc(amount(customer.paidAmount))}</td><td class="red summary-amount">${customer.debtCount} / ${esc(amount(customer.debtAmount))}</td><td class="cash summary-amount">${customer.cashCount || 0} / ${esc(amount(customer.cashAmount))}${cashTypeDetails ? `<br><span class="cash-detail">${esc(cashTypeDetails).replaceAll("&lt;br&gt;", "<br>")}</span>` : ""}</td></tr>`;
  }).join("");
  const paymentRows = Object.entries(summary.paymentTypes || {}).map(([type, value]) => `<div class="payment-row"><span>${esc(paymentMethodLabel(type))}</span><strong>${esc(amount(value))}</strong></div>`).join("") || `<div class="muted">ဒီနေ့ Ledger ငွေချေမှု မရှိသေးပါ။</div>`;
  const paymentTotal = Object.values(summary.paymentTypes || {}).reduce((total, value) => total + Number(value || 0), 0);
  const cashPaymentRows = Object.entries(summary.cashPaymentTypes || {}).map(([type, value]) => `<div class="payment-row cash-row"><span>${esc(paymentMethodLabel(type))}</span><strong>${esc(amount(value))}</strong></div>`).join("") || `<div class="muted">လက်ငင်းရောင်း မရှိသေးပါ။</div>`;
  const cashSaleTypeEntries = Object.entries(summary.cashSaleTypes || {}).filter(([, detail]) => Number(detail?.count || 0) > 0);
  const cashSaleTypeTotal = cashSaleTypeEntries.reduce((total, [, detail]) => ({ count: total.count + Number(detail?.count || 0), amount: total.amount + Number(detail?.amount || 0) }), { count: 0, amount: 0 });
  const cashSaleTypeRows = cashSaleTypeEntries.map(([type, detail]) => `<div class="payment-row ${type === "WHOLESALE" ? "wholesale-row" : "retail-row"}"><span>${esc(cashSaleTypeLabel(type))}</span><strong>${esc(`${detail.count} ခု / ${amount(detail.amount)}`)}</strong></div>`).join("") || `<div class="muted">လက်ငင်းအမျိုးအစား မရှိသေးပါ။</div>`;
  const cashSaleTypeTotalRow = cashSaleTypeEntries.length ? `<div class="payment-row sale-total-row"><span>စုစုပေါင်း</span><strong>${esc(`${cashSaleTypeTotal.count} ခု / ${amount(cashSaleTypeTotal.amount)}`)}</strong></div>` : "";
  const activityRows = logs.map((log) => {
    const metadata = log.metadata || {};
    const paymentDisplay = log.action === "CASH_SALE" && metadata.saleType
      ? `${paymentSplitLabel(getPaymentSplit(metadata)) || metadata.paymentType || "CASH"} · ${cashSaleTypeLabel(metadata.saleType)}`
      : metadata.paymentType || "";
    return `<tr class="${activityToneClass(log.action)}"><td class="activity-time">${esc(formatMyanmarDate(log.createdAt))}</td><td class="activity-actor">${esc(log.actorName || "")}</td><td class="activity-action">${esc(actionLabel(log.action))}</td><td class="activity-entity">${esc(log.entityLabel || log.entityType || "")}</td><td class="activity-amount">${esc(metadata.amount == null ? "" : amount(metadata.amount))}</td><td class="payment-cell">${esc(paymentDisplay)}</td><td class="activity-note">${esc(metadata.note || "")}</td></tr>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Padauk;src:url(data:font/ttf;base64,${fontDataUri}) format('truetype');font-weight:400}
    @font-face{font-family:DejaVu;src:url(data:font/ttf;base64,${latinDataUri}) format('truetype');font-weight:400}
    *{box-sizing:border-box} body{margin:0;background:#f8fafc;color:#0f172a;font-family:Padauk,DejaVu,sans-serif;font-size:24px} .page{width:1400px;margin:28px;padding:0;background:#f8fafc} .panel{padding:36px;background:#fff;border:1px solid #cbd5e1;border-radius:24px} h1,h2{font-family:DejaVu,Padauk,sans-serif;margin:0} h1{font-size:42px} h2{font-size:30px;margin:38px 0 18px} .subtitle{font-family:DejaVu,Padauk,sans-serif;font-size:20px;color:#475569;margin-top:6px} .cards{display:grid;grid-template-columns:repeat(5,1fr);gap:18px;margin-top:30px}.card{padding:22px;border-radius:16px;min-height:135px}.card:nth-child(1){background:#ecfdf5}.card:nth-child(2){background:#fff1f2}.card:nth-child(3){background:#ecfeff}.card:nth-child(4){background:#eff6ff}.card:nth-child(5){background:#f5f3ff}.card-label{font-size:23px;color:#334155}.card-value{font-family:DejaVu,Padauk,sans-serif;font-size:34px;margin-top:12px} .card-detail{font-family:DejaVu,Padauk,sans-serif;font-size:18px;color:#475569;margin-top:5px}.daily-sales-summary{margin-top:28px;padding:22px 26px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:18px}.daily-sales-summary h2{margin:0 0 16px;font-size:28px;color:#166534}.daily-sales-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.daily-sales-grid>div{padding:12px 14px;background:#fff;border-radius:12px}.daily-sales-grid span{display:block;font-size:18px;color:#475569}.daily-sales-grid strong{display:block;margin-top:4px;font-family:DejaVu,Padauk,sans-serif;font-size:23px;color:#166534}.daily-sales-meta{margin-top:14px;font-size:16px;color:#475569;line-height:1.45}.summary-table,.activity-table{width:100%;border-collapse:collapse;table-layout:fixed}.summary-table th,.summary-table td{padding:11px 14px;border-bottom:1px solid #e2e8f0;text-align:left;white-space:normal;overflow:visible;text-overflow:clip;vertical-align:top;line-height:1.35;overflow-wrap:anywhere}.summary-table th:nth-child(1),.summary-table td:nth-child(1){width:40%}.summary-table th:nth-child(2),.summary-table td:nth-child(2){width:20%;text-align:right}.summary-table th:nth-child(3),.summary-table td:nth-child(3){width:20%;text-align:right}.summary-table th:nth-child(4),.summary-table td:nth-child(4){width:20%;text-align:right}.summary-table .summary-amount{font-size:22px;font-weight:700;line-height:1.35}.green{color:#047857}.red{color:#be123c}.cash{color:#0e7490}.cash-detail{display:block;margin-top:6px;font-size:18px;font-weight:600;line-height:1.45;white-space:normal}.cash-row{background:#ecfeff}.retail-row{background:#f5f3ff;color:#6d28d9;border-left:5px solid #8b5cf6}.wholesale-row{background:#fffbeb;color:#b45309;border-left:5px solid #f59e0b}.sale-total-row{margin-top:8px;background:#ede9fe;color:#5b21b6;border-top:2px solid #c4b5fd;border-radius:10px;font-weight:800}.payment{background:#f8fafc;border-radius:16px;padding:22px 28px;margin-top:28px}.payment-row{display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:14px 0;font-size:21px;line-height:1.35}.payment-row span{font-weight:600}.payment-row strong{font-size:23px;font-weight:700;text-align:right}.cash-sales-total{margin:-4px 0 8px;padding:10px 12px;border-radius:10px;background:#cffafe;color:#155e75;font-size:21px;font-weight:700;text-align:right}.muted{color:#64748b}.activity-table{font-size:19px}.activity-table th,.activity-table td{padding:11px 8px;border-bottom:1px solid #e2e8f0;text-align:left;white-space:normal;overflow:visible;text-overflow:clip;vertical-align:top;overflow-wrap:anywhere;line-height:1.3}.activity-table th:nth-child(1),.activity-table td:nth-child(1){width:15%}.activity-table th:nth-child(2),.activity-table td:nth-child(2){width:7%}.activity-table th:nth-child(3),.activity-table td:nth-child(3){width:13%}.activity-table th:nth-child(4),.activity-table td:nth-child(4){width:21%}.activity-table th:nth-child(5),.activity-table td:nth-child(5){width:15%;text-align:right}.activity-table th:nth-child(6),.activity-table td:nth-child(6){width:15%}.activity-table th:nth-child(7),.activity-table td:nth-child(7){width:14%}.activity-table tbody tr{background:#fff}.activity-table tbody tr:nth-child(even){background:#f8fafc}.activity-table tbody tr:hover{background:#f1f5f9}.activity-table .activity-actor{font-size:14px;color:#475569;font-weight:600}.activity-table .activity-time,.activity-table .activity-note{font-size:15px;color:#475569;font-weight:500}.activity-table .activity-action{font-size:18px;font-weight:700}.activity-table .activity-entity{font-size:18px;font-weight:700;color:#1e293b}.activity-table .activity-amount{font-size:23px;font-weight:800;white-space:nowrap;text-align:right;color:#0f172a}.activity-table .payment-cell{font-size:21px;font-weight:800;color:#1e293b;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;line-height:1.3}.activity-row-payment .activity-action,.activity-row-payment .activity-amount{color:#047857}.activity-row-debt .activity-action,.activity-row-debt .activity-amount{color:#be123c}.activity-row-cash .activity-action,.activity-row-cash .activity-amount,.activity-row-cash .payment-cell{color:#0e7490}.activity-row-cash .payment-cell{background:#ecfeff;border-radius:8px;padding:5px 8px}.activity-row-neutral .activity-action{color:#475569}
  .cash-detail{font-size:18px;color:#155e75}  </style></head><body><main class="page"><section id="summary" class="panel"><h1>Daily Summary</h1><div class="subtitle">${esc(report.periodLabel)}</div><div class="cards"><div class="card"><div class="card-label">ငွေချေသူ</div><div class="card-value">${summary.paidCount}</div><div class="card-detail">${esc(amount(summary.paidAmount))}</div></div><div class="card"><div class="card-label">အကြွေးတိုးသူ</div><div class="card-value">${summary.debtCount}</div><div class="card-detail">${esc(amount(summary.debtAmount))}</div></div><div class="card"><div class="card-label">လက်ငင်းပေးသူ</div><div class="card-value">${summary.cashCount || 0}</div><div class="card-detail">${esc(amount(summary.cashAmount))}</div></div><div class="card"><div class="card-label">Transaction စုစုပေါင်း</div><div class="card-value">${summary.totalTransactions}</div></div><div class="card"><div class="card-label">လုပ်ဆောင်ချက်မှတ်တမ်း</div><div class="card-value">${summary.activityCount ?? summary.auditCount}</div></div></div><h2>Customer အလိုက် စာရင်းချုပ်</h2><table class="summary-table"><thead><tr><th>Customer</th><th>ငွေချေ</th><th>အကြွေးတိုး</th><th>လက်ငင်း</th></tr></thead><tbody>${customerRows || `<tr><td colspan="4">ဒီနေ့စာရင်းမရှိသေးပါ။</td></tr>`}</tbody></table><div class="payment"><h2 style="margin-top:0">Payment Type</h2><h2 style="margin-top:0;color:#047857">အကြွေးပြန်ဆပ်(ငွေချေ) အသေးစိတ်</h2><p class="payment-note">အောက်မှာရှိတဲ့ payment နည်းလမ်းတစ်ခုချင်းစီက Ledger မှာ ငွေချေပြီးသား မှတ်တမ်းတွေပါ။ လက်ငင်းရောင်းငွေ မပါဝင်ပါ။</p>${paymentRows}<div class="cash-sales-total">အကြွေးပြန်ဆပ်(ငွေချေ) စုစုပေါင်း ${esc(amount(paymentTotal))}</div><h2 style="margin-top:24px;color:#0e7490">လက်ငင်း(လက်လီ၊လက်ကား) အသေးစိတ်</h2><p class="payment-note cash-note">အောက်မှာရှိတဲ့ payment နည်းလမ်းတစ်ခုချင်းစီက Cash Sale မှာ ထည့်ထားတဲ့ လက်ငင်းရောင်းငွေထဲက ခွဲခြမ်းချက်ပါ။ Ledger စုစုပေါင်းနဲ့ မပေါင်းပါ။</p>${cashPaymentRows}<div class="cash-sales-total">လက်ငင်း(လက်လီ၊လက်ကား) စုစုပေါင်း ${esc(amount(summary.cashAmount))}</div><h2 style="margin-top:24px;color:#6d28d9">လက်ငင်း လက်လီ/လက်ကား ရောင်းအား</h2><p class="payment-note cash-type-note">လက်ငင်းရောင်းငွေကို Customer အမျိုးအစားအလိုက် လက်လီ/လက်ကား ခွဲပြထားတာပါ။ ဒီအပိုင်းက payment နည်းလမ်း မဟုတ်ဘဲ ရောင်းအားအမျိုးအစား ဖြစ်ပါတယ်။</p>${cashSaleTypeRows}${cashSaleTypeTotalRow}</div></section><section id="activity" class="panel"><h1>Activity History</h1><div class="subtitle">${esc(report.dateLabel)} Activity — ${logs.length} actions</div><table class="activity-table" style="margin-top:18px"><thead><tr><th>စာရင်းနေ့/အချိန်</th><th>လုပ်သူ</th><th>လုပ်ဆောင်ချက်</th><th>Customer / အကြောင်းအရာ</th><th>ပမာဏ</th><th>Payment</th><th>Note</th></tr></thead><tbody>${activityRows || `<tr><td colspan="7">ဒီနေ့လုပ်ဆောင်ချက်မရှိသေးပါ။</td></tr>`}</tbody></table></section></main></body></html>`;
}

function formatReportDateLabel(dateLabel) {
  const [year, month, day] = String(dateLabel || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(dateLabel || "");
}

export function createDailySalesSummaryCardHtml(data, fontDataUri, latinDataUri) {
  const esc = escapeXml;
  const card = (label, value, tone) => `<div class="sales-card ${tone}"><div class="sales-label">${esc(label)}</div><div class="sales-value">${esc(amount(value))}</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Padauk;src:url(data:font/ttf;base64,${fontDataUri}) format('truetype');font-weight:400}
    @font-face{font-family:DejaVu;src:url(data:font/ttf;base64,${latinDataUri}) format('truetype');font-weight:400}
    *{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a;font-family:Padauk,DejaVu,sans-serif}.sheet{width:1100px;padding:34px;background:#fff;border:1px solid #cbd5e1;border-radius:28px}.brand{font-family:DejaVu,Padauk,sans-serif;font-size:18px;letter-spacing:2px;color:#4338ca;font-weight:700}.title{font-size:38px;font-weight:700;margin-top:6px}.date{font-family:DejaVu,Padauk,sans-serif;font-size:21px;color:#475569;margin-top:6px}.rule{height:2px;background:#e2e8f0;margin:24px 0}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.sales-card{padding:22px 24px;border-radius:18px;min-height:126px;border:1px solid #e2e8f0}.sales-card.retail{background:#f5f3ff;border-color:#ddd6fe}.sales-card.wholesale{background:#fffbeb;border-color:#fde68a}.sales-card.daily{background:#fff1f2;border-color:#fecdd3}.sales-card.cash{background:#ecfeff;border-color:#a5f3fc}.sales-card.opening{background:#ecfdf5;border-color:#bbf7d0}.opening-wrap{display:flex;justify-content:center}.opening-wrap .sales-card{width:52%;margin-top:18px}.sales-label{font-size:22px;color:#334155}.sales-value{font-family:DejaVu,Padauk,sans-serif;font-size:33px;font-weight:700;margin-top:12px}.footer{margin-top:22px;text-align:center;color:#64748b;font-size:17px}.footer strong{color:#166534}.summary-box{margin-top:18px;padding:18px 22px;border-radius:16px;background:#f0fdf4;border:1px solid #bbf7d0;font-size:20px}.summary-box b{font-family:DejaVu,Padauk,sans-serif;color:#166534}.noncash{margin-top:14px;padding:16px 20px;border-radius:14px;background:#f8fafc;color:#475569;font-size:18px}
  </style></head><body><section id="sales-summary-card" class="sheet"><div class="brand">NEW LIFE LEDGER</div><div class="title">နေ့စဉ် လက်လီ / လက်ကား ရောင်းရငွေ</div><div class="date">စာရင်းရက် — ${esc(formatReportDateLabel(data.dateLabel))}</div><div class="rule"></div><div class="grid">${card("လက်လီ (ငွေသား + KPay/Bank/Wave)", data.retailTotal, "retail")}${card("လက်လီ (ငွေသား)", data.retailCash, "retail")}${card("လက်ကား (ငွေသား + KPay/Bank/Wave)", data.wholesaleTotal, "wholesale")}${card("လက်ကား (ငွေသား)", data.wholesaleCash, "wholesale")}${card("တစ်နေ့တာ လက်လီ + လက်ကား", data.dailyTotal, "daily")}${card("တစ်နေ့တာ ငွေသား", data.cashDailyTotal, "daily")}</div><div class="opening-wrap"><div class="sales-card opening"><div class="sales-label">လစဉ်စုစုပေါင်း / နောက်နေ့ Opening</div><div class="sales-value">${esc(amount(data.monthlyTotal))}</div><div class="sales-label" style="font-size:18px;margin-top:8px">Opening — ${esc(amount(data.opening))}</div></div></div></section></body></html>`;
}

export function createProductionSummaryHtml(report, fontDataUri, latinDataUri) {
  const esc = escapeXml;
  const summary = report.productionSummary || summarizeProductionReports(report.productionReports || []);
  const number = (value) => Number(value || 0).toLocaleString("en-US");
  const bottleRows = summary.bottles.map((item) => `<tr><td>${esc(item.label)}</td><td>${number(item.capacity)} ဆံ့</td><td>${number(item.quantity)} ${esc(item.unit)}</td><td>${number(item.pieces)} ဗူး</td></tr>`).join("") || `<tr><td colspan="4">ဒီနေ့ ဗူးထွက်ရှိမှု မရှိသေးပါ။</td></tr>`;
  const tubeRows = summary.tubes.map((item) => `<tr><td>${esc(item.label)}</td><td>${number(item.capacity)} ခု</td><td>${number(item.quantity)} ${esc(item.unit)}</td><td>${number(item.pieces)} ခု</td></tr>`).join("") || `<tr><td colspan="4">ဒီနေ့ Tube ထုတ်လုပ်မှု မရှိသေးပါ။</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Padauk;src:url(data:font/ttf;base64,${fontDataUri}) format('truetype');font-weight:400}@font-face{font-family:DejaVu;src:url(data:font/ttf;base64,${latinDataUri}) format('truetype');font-weight:400}*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a;font-family:Padauk,DejaVu,sans-serif}.sheet{width:1100px;padding:34px;background:#fff;border:1px solid #cbd5e1;border-radius:28px}.brand{font-family:DejaVu,Padauk,sans-serif;font-size:18px;letter-spacing:2px;color:#4338ca;font-weight:700}.title{font-size:38px;font-weight:700;margin-top:6px}.date{font-family:DejaVu,Padauk,sans-serif;font-size:21px;color:#475569;margin-top:6px}.rule{height:2px;background:#e2e8f0;margin:24px 0}h2{font-size:26px;margin:22px 0 10px;color:#3730a3}.production-table{width:100%;border-collapse:collapse;font-size:21px}.production-table th,.production-table td{padding:11px 12px;border-bottom:1px solid #e2e8f0;text-align:left}.production-table th{background:#e0e7ff;color:#312e81}.production-table td:nth-child(n+2),.production-table th:nth-child(n+2){text-align:right}.tube-title{color:#c2410c}.tube-table th{background:#ffedd5;color:#9a3412}.totals{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px}.total{padding:16px;border-radius:14px;background:#ecfdf5;border:1px solid #bbf7d0}.total:nth-child(2){background:#fff1f2;border-color:#fecdd3}.total:nth-child(3),.total:nth-child(4){background:#fff7ed;border-color:#fed7aa}.total-label{font-size:17px;color:#475569}.total-value{font-family:DejaVu,Padauk,sans-serif;font-size:25px;font-weight:700;margin-top:6px}</style></head><body><section id="production-summary" class="sheet"><div class="brand">NEW LIFE LEDGER</div><div class="title">ဗူးထွက်ရှိမှုစာရင်း</div><div class="date">စာရင်းရက် — ${esc(formatReportDateLabel(report.dateLabel))}</div><div class="rule"></div><h2>စာအုပ်မှတ်တမ်းအကျဉ်းချုပ် — ဗူး</h2><table class="production-table"><thead><tr><th>ဗူးအမျိုးအစား</th><th>ဆံ့</th><th>အရေအတွက်</th><th>စုစုပေါင်းဗူး</th></tr></thead><tbody>${bottleRows}</tbody></table><h2 class="tube-title">Tube အကျဉ်းချုပ်</h2><table class="production-table tube-table"><thead><tr><th>Tube အမျိုးအစား</th><th>တစ်ကြိမ်ဆံ့</th><th>အရေအတွက်</th><th>စုစုပေါင်း Tube</th></tr></thead><tbody>${tubeRows}</tbody></table><div class="totals"><div class="total"><div class="total-label">စုစုပေါင်းထွက်ရှိမှု</div><div class="total-value">${number(summary.totalOutput)} ဗူး</div></div><div class="total"><div class="total-label">ဗူးပျက်စုစုပေါင်း</div><div class="total-value">${number(summary.totalWaste)} ဗူး</div></div><div class="total"><div class="total-label">Tube ပျက်</div><div class="total-value">${number(summary.totalTubeDamage)} ခု</div></div><div class="total"><div class="total-label">Tube အရေအတွက်</div><div class="total-value">${esc(summary.tubeQuantityValue)} ${esc(summary.tubeQuantityUnit)}</div></div></div></section></body></html>`;
}

let chromiumExecutablePromise;
const reportImageCache = new WeakMap();

function getChromiumExecutablePath() {
  if (!chromiumExecutablePromise) {
    chromiumExecutablePromise = chromium.executablePath(REMOTE_CHROMIUM_PACK_URL).catch((error) => {
      chromiumExecutablePromise = undefined;
      throw error;
    });
  }
  return chromiumExecutablePromise;
}

async function renderReportImagesUncached(report) {
  const fontPath = resolveFontPath();
  const latinFontPath = resolveLatinFontPath();
  if (!fontPath || !latinFontPath) throw new Error("Daily report font assets are unavailable in the serverless bundle");
  const browser = await playwright.launch({
    args: chromium.args,
    executablePath: await getChromiumExecutablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1480, height: 900 }, deviceScaleFactor: 1 });
    const html = createReportHtml(
      report,
      fs.readFileSync(fontPath).toString("base64"),
      fs.readFileSync(latinFontPath).toString("base64"),
    );
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const summaryBuffer = Buffer.from(await page.locator("#summary").screenshot({ type: "png" }));
    const salesData = await getDailySalesSummaryCardData(report.dateLabel);
    const salesHtml = createDailySalesSummaryCardHtml(
      salesData,
      fs.readFileSync(fontPath).toString("base64"),
      fs.readFileSync(latinFontPath).toString("base64"),
    );
    await page.setContent(salesHtml, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const salesSummaryBuffer = Buffer.from(await page.locator("#sales-summary-card").screenshot({ type: "png" }));
    const bottleSalesHtml = createBottleSalesSummaryHtml(report, fs.readFileSync(fontPath).toString("base64"), fs.readFileSync(latinFontPath).toString("base64"));
    await page.setContent(bottleSalesHtml, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const bottleSalesBuffer = Buffer.from(await page.locator("#bottle-sales-summary").screenshot({ type: "png" }));
    return { summaryBuffer, salesSummaryBuffer, bottleSalesBuffer };
  } finally {
    await browser.close();
  }
}

function renderReportImages(report) {
  if (!reportImageCache.has(report)) {
    const promise = renderReportImagesUncached(report).catch((error) => {
      reportImageCache.delete(report);
      throw error;
    });
    reportImageCache.set(report, promise);
  }
  return reportImageCache.get(report);
}

export async function createDailySummaryImage(report) {
  const { summaryBuffer } = await renderReportImages(report);
  return summaryBuffer;
}

export async function createDailyActivityImage(report) {
  const { activityBuffer } = await renderReportImages(report);
  return activityBuffer;
}

export async function createDailySalesSummaryImage(report) {
  const { salesSummaryBuffer } = await renderReportImages(report);
  return salesSummaryBuffer;
}

export async function createDailyReportPdf(report) {
  const { summaryBuffer, salesSummaryBuffer, bottleSalesBuffer } = await renderReportImages(report);
  const pdfDoc = await PDFDocument.create();
  for (const imageBuffer of [summaryBuffer, salesSummaryBuffer, bottleSalesBuffer]) {
    const image = await pdfDoc.embedPng(imageBuffer);
    const page = pdfDoc.addPage([900, 900 * image.height / image.width]);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  return Buffer.from(await pdfDoc.save());
}
