import { PDFDocument } from "pdf-lib";
import chromium from "@sparticuz/chromium-min";
import { chromium as playwright } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { ensureDatabase } from "@/lib/database";
import { getMyanmarDayRange } from "@/lib/myanmar-time";
import { cashSaleTypeLabel, normalizeCashSaleType, summarizeCashSalesByType } from "@/lib/cash-sale-utils";
import { accountingAuditLogWhere, isOrderWorkflowActivity } from "@/lib/accounting-activity";

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

export async function getDailyReportData({ start, end, dateLabel } = getPreviousMyanmarDayRange()) {
  await ensureDatabase();
  const [ledgers, cashSales, allAuditLogs] = await Promise.all([
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
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.auditLog.findMany({
      where: {
        AND: [
          { createdAt: { gte: start, lt: end } },
          { NOT: { action: "DAILY_REPORT_SENT" } },
          accountingAuditLogWhere(),
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const auditLogs = allAuditLogs.filter((log) => !log.hiddenAt && !isOrderWorkflowActivity(log));
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
    const paymentType = cashSale.paymentType || "CASH";
    summary.cashPaymentTypes[paymentType] = (summary.cashPaymentTypes[paymentType] || 0) + Number(cashSale.amount || 0);
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
  };
}

function resolveFontPath() {
  const bundled = path.join(process.cwd(), "assets", "Padauk-Regular.ttf");
  return fs.existsSync(bundled) ? bundled : null;
}

function resolveLatinFontPath() {
  const bundled = path.join(process.cwd(), "assets", "DejaVuSans.ttf");
  return fs.existsSync(bundled) ? bundled : null;
}

function actionLabel(action) {
  return ({ PAYMENT: "ငွေချေ", DEBT_INCREASE: "အကြွေးတိုး", CASH_SALE: "လက်ငင်းရောင်း", CREATE: "အသစ်ထည့်", UPDATE: "ပြင်ဆင်", RESTORE: "ပြန်ယူ", DELETE: "ဖျက်", PERMANENT_DELETE: "အပြီးဖျက်", })[action] || action;
}

function clipText(value, maxLength) {
  const text = String(value ?? "");
  const chars = Array.from(text);
  return chars.length > maxLength ? `${chars.slice(0, maxLength - 1).join("")}…` : text;
}

function createReportHtml(report, fontDataUri, latinDataUri) {
  const { summary } = report;
  const customers = report.customers || [];
  const logs = report.activityLogs || report.auditLogs || [];
  const esc = escapeXml;
  const customerRows = customers.map((customer) => {
    const cashTypeDetails = [
      customer.cashRetailCount ? `လက်လီ ${customer.cashRetailCount} / ${amount(customer.cashRetailAmount)}` : null,
      customer.cashWholesaleCount ? `လက်ကား ${customer.cashWholesaleCount} / ${amount(customer.cashWholesaleAmount)}` : null,
    ].filter(Boolean).join(" · ");
    return `<tr><td>${esc(customer.customerName)}</td><td class="green">${customer.paidCount} / ${esc(amount(customer.paidAmount))}</td><td class="red">${customer.debtCount} / ${esc(amount(customer.debtAmount))}</td><td class="cash">${customer.cashCount || 0} / ${esc(amount(customer.cashAmount))}${cashTypeDetails ? `<br><span class="cash-detail">${esc(cashTypeDetails)}</span>` : ""}</td></tr>`;
  }).join("");
  const paymentRows = Object.entries(summary.paymentTypes || {}).map(([type, value]) => `<div class="payment-row"><span>${esc(type)}</span><strong>${esc(amount(value))}</strong></div>`).join("") || `<div class="muted">Ledger ငွေချေမှုမရှိသေးပါ။</div>`;
  const cashPaymentRows = Object.entries(summary.cashPaymentTypes || {}).map(([type, value]) => `<div class="payment-row cash-row"><span>${esc(type)}</span><strong>${esc(amount(value))}</strong></div>`).join("") || `<div class="muted">လက်ငင်းရောင်း မရှိသေးပါ။</div>`;
  const cashSaleTypeRows = Object.entries(summary.cashSaleTypes || {}).filter(([, detail]) => Number(detail?.count || 0) > 0).map(([type, detail]) => `<div class="payment-row cash-row"><span>${esc(cashSaleTypeLabel(type))}</span><strong>${esc(`${detail.count} ခု / ${amount(detail.amount)}`)}</strong></div>`).join("") || `<div class="muted">လက်ငင်းအမျိုးအစား မရှိသေးပါ။</div>`;
  const activityRows = logs.map((log) => {
    const metadata = log.metadata || {};
    const paymentDisplay = log.action === "CASH_SALE" && metadata.saleType
      ? `${metadata.paymentType || "CASH"} · ${cashSaleTypeLabel(metadata.saleType)}`
      : metadata.paymentType || "";
    return `<tr><td>${esc(formatMyanmarDate(log.createdAt))}</td><td>${esc(log.actorName || "")}</td><td>${esc(actionLabel(log.action))}</td><td>${esc(log.entityLabel || log.entityType || "")}</td><td>${esc(metadata.amount == null ? "" : amount(metadata.amount))}</td><td>${esc(paymentDisplay)}</td><td>${esc(metadata.note || "")}</td><td>${esc(log.eventSource === "legacy" ? "အရင်စာရင်း" : "အသစ်မှတ်တမ်း")}</td></tr>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Padauk;src:url(data:font/ttf;base64,${fontDataUri}) format('truetype');font-weight:400}
    @font-face{font-family:DejaVu;src:url(data:font/ttf;base64,${latinDataUri}) format('truetype');font-weight:400}
    *{box-sizing:border-box} body{margin:0;background:#f8fafc;color:#0f172a;font-family:Padauk,DejaVu,sans-serif;font-size:24px} .page{width:1400px;margin:28px;padding:0;background:#f8fafc} .panel{padding:36px;background:#fff;border:1px solid #cbd5e1;border-radius:24px} h1,h2{font-family:DejaVu,Padauk,sans-serif;margin:0} h1{font-size:42px} h2{font-size:30px;margin:38px 0 18px} .subtitle{font-family:DejaVu,Padauk,sans-serif;font-size:20px;color:#475569;margin-top:6px} .cards{display:grid;grid-template-columns:repeat(5,1fr);gap:18px;margin-top:30px}.card{padding:22px;border-radius:16px;min-height:135px}.card:nth-child(1){background:#ecfdf5}.card:nth-child(2){background:#fff1f2}.card:nth-child(3){background:#ecfeff}.card:nth-child(4){background:#eff6ff}.card:nth-child(5){background:#f5f3ff}.card-label{font-size:23px;color:#334155}.card-value{font-family:DejaVu,Padauk,sans-serif;font-size:34px;margin-top:12px}.card-detail{font-family:DejaVu,Padauk,sans-serif;font-size:18px;color:#475569;margin-top:5px}.summary-table,.activity-table{width:100%;border-collapse:collapse;table-layout:fixed}.summary-table th,.summary-table td{padding:11px 14px;border-bottom:1px solid #e2e8f0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.summary-table th:nth-child(1),.summary-table td:nth-child(1){width:46%}.summary-table th:nth-child(2),.summary-table td:nth-child(2){width:18%;text-align:right}.summary-table th:nth-child(3),.summary-table td:nth-child(3){width:18%;text-align:right}.summary-table th:nth-child(4),.summary-table td:nth-child(4){width:18%;text-align:right}.green{color:#047857}.red{color:#be123c}.cash{color:#0e7490}.cash-row{background:#ecfeff}.payment{background:#f8fafc;border-radius:16px;padding:22px 28px;margin-top:28px}.payment-row{display:flex;justify-content:space-between;padding:9px 0}.muted{color:#64748b}.activity-table{font-size:18px}.activity-table th,.activity-table td{padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.activity-table th:nth-child(1),.activity-table td:nth-child(1){width:14%}.activity-table th:nth-child(2),.activity-table td:nth-child(2){width:10%}.activity-table th:nth-child(3),.activity-table td:nth-child(3){width:12%}.activity-table th:nth-child(4),.activity-table td:nth-child(4){width:25%}.activity-table th:nth-child(5),.activity-table td:nth-child(5){width:14%;text-align:right}.activity-table th:nth-child(6),.activity-table td:nth-child(6){width:9%}.activity-table th:nth-child(7),.activity-table td:nth-child(7){width:8%}.activity-table th:nth-child(8),.activity-table td:nth-child(8){width:8%}
  .cash-detail{font-size:16px;color:#155e75}  </style></head><body><main class="page"><section id="summary" class="panel"><h1>Daily Summary</h1><div class="subtitle">${esc(report.periodLabel)}</div><div class="cards"><div class="card"><div class="card-label">ငွေချေသူ</div><div class="card-value">${summary.paidCount}</div><div class="card-detail">${esc(amount(summary.paidAmount))}</div></div><div class="card"><div class="card-label">အကြွေးတိုးသူ</div><div class="card-value">${summary.debtCount}</div><div class="card-detail">${esc(amount(summary.debtAmount))}</div></div><div class="card"><div class="card-label">လက်ငင်းပေးသူ</div><div class="card-value">${summary.cashCount || 0}</div><div class="card-detail">${esc(amount(summary.cashAmount))}</div></div><div class="card"><div class="card-label">Transaction စုစုပေါင်း</div><div class="card-value">${summary.totalTransactions}</div></div><div class="card"><div class="card-label">လုပ်ဆောင်ချက်မှတ်တမ်း</div><div class="card-value">${summary.activityCount ?? summary.auditCount}</div></div></div><h2>Customer အလိုက် စာရင်းချုပ်</h2><table class="summary-table"><thead><tr><th>Customer</th><th>ငွေချေ</th><th>အကြွေးတိုး</th><th>လက်ငင်း</th></tr></thead><tbody>${customerRows || `<tr><td colspan="4">ဒီနေ့စာရင်းမရှိသေးပါ။</td></tr>`}</tbody></table><div class="payment"><h2 style="margin-top:0">Payment Type</h2>${paymentRows}<h2 style="margin-top:24px">လက်ငင်းငွေပေးချေမှု</h2>${cashPaymentRows}<h2 style="margin-top:24px">လက်ငင်းအမျိုးအစား</h2>${cashSaleTypeRows}</div></section><section id="activity" class="panel"><h1>Activity History</h1><div class="subtitle">${esc(report.dateLabel)} Activity — ${logs.length} actions</div><table class="activity-table" style="margin-top:18px"><thead><tr><th>စာရင်းနေ့/အချိန်</th><th>လုပ်သူ</th><th>လုပ်ဆောင်ချက်</th><th>Customer / အကြောင်းအရာ</th><th>ပမာဏ</th><th>Payment</th><th>Note</th><th>Source</th></tr></thead><tbody>${activityRows || `<tr><td colspan="8">ဒီနေ့လုပ်ဆောင်ချက်မရှိသေးပါ။</td></tr>`}</tbody></table></section></main></body></html>`;
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
    const activityBuffer = Buffer.from(await page.locator("#activity").screenshot({ type: "png" }));
    return { summaryBuffer, activityBuffer };
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

export async function createDailyReportPdf(report) {
  const { summaryBuffer, activityBuffer } = await renderReportImages(report);
  const pdfDoc = await PDFDocument.create();
  for (const imageBuffer of [summaryBuffer, activityBuffer]) {
    const image = await pdfDoc.embedPng(imageBuffer);
    const page = pdfDoc.addPage([900, 900 * image.height / image.width]);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  return Buffer.from(await pdfDoc.save());
}
