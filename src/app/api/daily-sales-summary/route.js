import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDateInputValue, getMyanmarDayRange } from "@/lib/myanmar-time";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { normalizeCashSaleType } from "@/lib/cash-sale-utils";
import { getPaymentSplit, hasPaymentBreakdownInput } from "@/lib/payment-split";

export const dynamic = "force-dynamic";

const CASH_PAYMENT_TYPE = "CASH";
const SUMMARY_SELECT = {
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
  calculationMode: true,
  sourceSnapshotAt: true,
  sourceTransactionCount: true,
  sourceTransactionTotal: true,
  adjustmentReason: true,
  lastCalculatedAt: true,
  lastCalculatedBy: true,
  createdAt: true,
  updatedAt: true,
};

function toAmount(value) {
  const amount = Math.round(Number(value || 0));
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function parseDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("ရက်စွဲပုံစံ မမှန်ပါ။");
  const range = getMyanmarDayRange(text);
  return { text, range };
}

async function getSourceSnapshot(date) {
  const { range } = parseDate(date);
  const [ledgers, cashSales] = await Promise.all([
    prisma.ledger?.findMany
      ? prisma.ledger.findMany({ where: { date: { gte: range.start, lt: range.end } }, select: { amount: true, type: true } })
      : Promise.resolve([]),
    prisma.cashSale?.findMany
      ? prisma.cashSale.findMany({ where: { date: { gte: range.start, lt: range.end } }, select: { amount: true } })
      : Promise.resolve([]),
  ]);
  const includedLedgers = ledgers.filter((row) => row.type === "DEBIT");
  const amounts = [...includedLedgers, ...cashSales].map((row) => toAmount(row.amount));
  return {
    capturedAt: new Date(),
    transactionCount: amounts.length,
    transactionTotal: amounts.reduce((total, amount) => total + amount, 0),
  };
}

function parseMonth(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(text)) throw new Error("လပုံစံ မမှန်ပါ။");
  return text;
}

function emptySummary() {
  return {
    retailTotal: 0,
    wholesaleTotal: 0,
    dailyTotal: 0,
    retailCash: 0,
    wholesaleCash: 0,
    cashDailyTotal: 0,
    recordCount: 0,
    paymentTypes: {},
  };
}

function addPaymentTypes(target, split) {
  for (const [key, amount] of Object.entries(split)) {
    if (amount > 0) target[key] = (target[key] || 0) + amount;
  }
}

function summarizeCashSales(sales) {
  const summary = emptySummary();
  for (const sale of sales) {
    const amount = toAmount(sale.amount);
    const saleType = normalizeCashSaleType(sale.saleType);
    const split = getPaymentSplit(sale);
    summary.recordCount += 1;
    if (saleType === "WHOLESALE") summary.wholesaleTotal += amount;
    else summary.retailTotal += amount;
    if (saleType === "WHOLESALE") summary.wholesaleCash += split.CASH;
    else summary.retailCash += split.CASH;
    addPaymentTypes(summary.paymentTypes, split);
  }
  summary.dailyTotal = summary.retailTotal + summary.wholesaleTotal;
  summary.cashDailyTotal = summary.retailCash + summary.wholesaleCash;
  return summary;
}

function summarizeLedgerPayments(ledgers) {
  const summary = emptySummary();
  for (const ledger of ledgers) {
    if (String(ledger.type || "").toUpperCase() !== "DEBIT") continue;
    const amount = toAmount(ledger.amount);
    const split = getPaymentSplit(ledger);
    summary.recordCount += 1;
    summary.wholesaleTotal += amount;
    summary.wholesaleCash += split.CASH;
    addPaymentTypes(summary.paymentTypes, split);
  }
  summary.dailyTotal = summary.retailTotal + summary.wholesaleTotal;
  summary.cashDailyTotal = summary.retailCash + summary.wholesaleCash;
  return summary;
}

function combineSummaries(...summaries) {
  const result = emptySummary();
  for (const summary of summaries) {
    result.retailTotal += summary.retailTotal;
    result.wholesaleTotal += summary.wholesaleTotal;
    result.retailCash += summary.retailCash;
    result.wholesaleCash += summary.wholesaleCash;
    result.recordCount += summary.recordCount;
    for (const [key, amount] of Object.entries(summary.paymentTypes || {})) {
      result.paymentTypes[key] = (result.paymentTypes[key] || 0) + amount;
    }
  }
  result.dailyTotal = result.retailTotal + result.wholesaleTotal;
  result.cashDailyTotal = result.retailCash + result.wholesaleCash;
  return result;
}

function summarizeSavedRow(row) {
  const retailTotal = toAmount(row.retailTotal);
  const wholesaleTotal = toAmount(row.wholesaleTotal);
  const retailCash = toAmount(row.retailCash);
  const wholesaleCash = toAmount(row.wholesaleCash);
  return {
    retailTotal,
    wholesaleTotal,
    dailyTotal: retailTotal + wholesaleTotal,
    retailCash,
    wholesaleCash,
    cashDailyTotal: retailCash + wholesaleCash,
    recordCount: 1,
    paymentTypes: {},
  };
}

function serializeRow(date, summary, source, savedAt = null, metadata = {}) {
  return { date, ...summary, source, savedAt, ...metadata };
}

async function captureFutureSourceLinks(summaryId, date) {
  // Keep tests and legacy deployments safe if the additive model has not been generated yet.
  if (!prisma.dailySalesSummarySource?.upsert) return;
  const { range } = parseDate(date);
  const [ledgers, cashSales] = await Promise.all([
    prisma.ledger.findMany({
      where: { date: { gte: range.start, lt: range.end } },
      select: { id: true, amount: true, paymentType: true, type: true },
    }),
    prisma.cashSale.findMany({
      where: { date: { gte: range.start, lt: range.end } },
      select: { id: true, amount: true, paymentType: true, paymentBreakdown: true, saleType: true },
    }),
  ]);
  const links = [
    ...ledgers.map((ledger) => ({
      sourceType: "LEDGER",
      sourceId: ledger.id,
      contributionType: "LEDGER_TOTAL",
      amount: toAmount(ledger.amount),
      paymentType: ledger.paymentType || null,
    })),
    ...cashSales.map((sale) => ({
      sourceType: "CASH_SALE",
      sourceId: sale.id,
      contributionType: normalizeCashSaleType(sale.saleType) === "WHOLESALE" ? "WHOLESALE_TOTAL" : "RETAIL_TOTAL",
      amount: toAmount(sale.amount),
      paymentType: hasPaymentBreakdownInput(sale.paymentBreakdown) ? "MIXED" : sale.paymentType || CASH_PAYMENT_TYPE,
    })),
  ];
  await Promise.all(links.map((link) => prisma.dailySalesSummarySource.upsert({
    where: {
      summaryId_sourceType_sourceId_contributionType: {
        summaryId,
        sourceType: link.sourceType,
        sourceId: link.sourceId,
        contributionType: link.contributionType,
      },
    },
    update: { amount: link.amount, paymentType: link.paymentType },
    create: { summaryId, ...link },
  })));
}

function validateDailyInput(body) {
  const { text: date } = parseDate(body.date);
  const retailTotal = toAmount(body.retailTotal);
  const wholesaleTotal = toAmount(body.wholesaleTotal);
  const retailCash = toAmount(body.retailCash);
  const wholesaleCash = toAmount(body.wholesaleCash);
  if (retailCash > retailTotal || wholesaleCash > wholesaleTotal) {
    throw new Error("ငွေသားပမာဏသည် သက်ဆိုင်ရာ လက်လီ/လက်ကားစုစုပေါင်းထက် မကျော်ရပါ။");
  }
  const requestedMode = String(body.calculationMode || "MANUAL").trim().toUpperCase();
  const calculationMode = ["AUTO", "MANUAL", "AUTO_ADJUSTED"].includes(requestedMode) ? requestedMode : "MANUAL";
  return {
    date,
    retailTotal,
    wholesaleTotal,
    retailCash,
    wholesaleCash,
    calculationMode,
    adjustmentReason: body.adjustmentReason?.trim() || null,
    note: body.note?.trim() || null,
  };
}

async function readSummary(date) {
  const { range } = parseDate(date);
  const month = date.slice(0, 7);
  const monthStart = getMyanmarDayRange(`${month}-01`).start;
  const [cashSales, ledgers, savedRows, opening] = await Promise.all([
    prisma.cashSale.findMany({
      where: { date: { gte: monthStart, lt: range.end } },
      select: { date: true, saleType: true, paymentType: true, paymentBreakdown: true, note: true, amount: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.ledger?.findMany
      ? prisma.ledger.findMany({
          where: { date: { gte: monthStart, lt: range.end } },
          select: { date: true, type: true, paymentType: true, note: true, amount: true },
          orderBy: [{ date: "asc" }, { id: "asc" }],
        })
      : Promise.resolve([]),
    prisma.dailySalesSummary.findMany({
      where: { date: { gte: `${month}-01`, lte: date } },
      select: SUMMARY_SELECT,
      orderBy: [{ date: "asc" }],
    }),
    prisma.dailySalesOpening.findUnique({ where: { month } }),
  ]);

  const cashByDate = new Map();
  for (const sale of cashSales) {
    const saleDate = getMyanmarDateInputValue(sale.date);
    const current = cashByDate.get(saleDate) || [];
    current.push(sale);
    cashByDate.set(saleDate, current);
  }
  const ledgerByDate = new Map();
  for (const ledger of ledgers) {
    const ledgerDate = getMyanmarDateInputValue(ledger.date);
    const current = ledgerByDate.get(ledgerDate) || [];
    current.push(ledger);
    ledgerByDate.set(ledgerDate, current);
  }
  const savedByDate = new Map(savedRows.map((row) => [row.date, row]));
  const selectedCash = summarizeCashSales(cashByDate.get(date) || []);
  const selectedLedgerPayments = summarizeLedgerPayments(ledgerByDate.get(date) || []);
  const selectedAuto = combineSummaries(selectedCash, selectedLedgerPayments);
  const selectedSaved = savedByDate.get(date);
  const selectedDay = selectedSaved
    ? {
        ...summarizeSavedRow(selectedSaved),
        source: "DAILY_SUMMARY",
        savedAt: selectedSaved.updatedAt,
        enteredAt: selectedSaved.enteredAt || null,
        enteredBy: selectedSaved.enteredBy || null,
      }
    : { ...selectedAuto, source: selectedAuto.recordCount ? "AUTO_PREVIEW" : "NONE", savedAt: null };

  const rows = new Map();
  const autoRows = new Map();
  const allDates = new Set([...cashByDate.keys(), ...ledgerByDate.keys()]);
  for (const rowDate of allDates) {
    autoRows.set(rowDate, serializeRow(rowDate, combineSummaries(summarizeCashSales(cashByDate.get(rowDate) || []), summarizeLedgerPayments(ledgerByDate.get(rowDate) || [])), "AUTO_PREVIEW", null));
  }
  for (const [rowDate, row] of autoRows.entries()) {
    rows.set(rowDate, row);
  }
  for (const row of savedRows) {
    rows.set(row.date, serializeRow(row.date, summarizeSavedRow(row), "DAILY_SUMMARY", row.updatedAt, {
      enteredAt: row.enteredAt || null,
      enteredBy: row.enteredBy || null,
    }));
  }
  const sortedRows = [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
  const openingAmount = toAmount(opening?.amount);
  const openingAsOfDate = opening?.asOfDate || "";
  const monthlyTotal = openingAmount + sortedRows
    .filter((row) => (!openingAsOfDate || row.date > openingAsOfDate) && row.date <= date)
    .reduce((total, row) => total + row.dailyTotal, 0);

  return {
    date,
    selectedDay,
    autoPreview: selectedAuto,
    autoRows: [...autoRows.values()].sort((a, b) => a.date.localeCompare(b.date)),
    monthlyTotal,
    opening: opening
      ? { amount: openingAmount, asOfDate: openingAsOfDate, note: opening.note || "", updatedAt: opening.updatedAt }
      : { amount: 0, asOfDate: "", note: "", updatedAt: null },
    rows: sortedRows,
    source: selectedDay.source,
  };
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const requestedDate = searchParams.get("date") || getMyanmarDateInputValue(new Date());
    const { text: date } = parseDate(requestedDate);
    const data = await readSummary(date);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: error.message?.includes("မမှန်") || error.message?.includes("မကျော်") ? 400 : 500 });
  }
}

export async function POST(request) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const actorName = getActorName(request);

    if (body.action === "opening") {
      const month = parseMonth(body.month);
      const { text: asOfDate } = parseDate(body.asOfDate);
      const { text: selectedDate } = parseDate(body.selectedDate || body.asOfDate);
      if (!asOfDate.startsWith(`${month}-`) || !selectedDate.startsWith(`${month}-`)) throw new Error("Opening ရက်စွဲသည် ရွေးထားသောလအတွင်း ဖြစ်ရပါမည်။");
      if (asOfDate > selectedDate) throw new Error("Opening ရက်စွဲသည် ရွေးထားသောနေ့ထက် မကျော်ရပါ။");
      const amount = toAmount(body.amount);
      const opening = await prisma.dailySalesOpening.upsert({
        where: { month },
        update: { amount, asOfDate, note: body.note?.trim() || null },
        create: { month, amount, asOfDate, note: body.note?.trim() || null },
      });
      await writeAuditLog({
        actorName,
        action: "DAILY_SALES_OPENING",
        entityType: "DailySalesOpening",
        entityId: opening.id,
        entityLabel: month,
        summary: `${month} လက်လီ/လက်ကား စာအုပ်အစ ${amount.toLocaleString()} Ks`,
        metadata: { month, amount, asOfDate },
      });
      return NextResponse.json({ ok: true, data: await readSummary(selectedDate) });
    }

    const input = validateDailyInput(body);
    const sourceSnapshot = await getSourceSnapshot(input.date);
    const existing = prisma.dailySalesSummary.findUnique
      ? await prisma.dailySalesSummary.findUnique({
          where: { date: input.date },
          select: { id: true, enteredAt: true, enteredBy: true },
        })
      : null;
    const row = await prisma.dailySalesSummary.upsert({
      where: { date: input.date },
      update: {
        retailTotal: input.retailTotal,
        wholesaleTotal: input.wholesaleTotal,
        retailCash: input.retailCash,
        wholesaleCash: input.wholesaleCash,
        source: "DAILY_INPUT",
        note: input.note,
        calculationMode: input.calculationMode,
        sourceSnapshotAt: sourceSnapshot.capturedAt,
        sourceTransactionCount: sourceSnapshot.transactionCount,
        sourceTransactionTotal: sourceSnapshot.transactionTotal,
        adjustmentReason: input.calculationMode === "AUTO" ? null : input.adjustmentReason,
        lastCalculatedAt: sourceSnapshot.capturedAt,
        lastCalculatedBy: input.calculationMode === "AUTO" ? "SYSTEM" : actorName || null,
      },
      create: {
        date: input.date,
        enteredAt: new Date(),
        enteredBy: actorName || null,
        retailTotal: input.retailTotal,
        wholesaleTotal: input.wholesaleTotal,
        retailCash: input.retailCash,
        wholesaleCash: input.wholesaleCash,
        source: "DAILY_INPUT",
        note: input.note,
        calculationMode: input.calculationMode,
        sourceSnapshotAt: sourceSnapshot.capturedAt,
        sourceTransactionCount: sourceSnapshot.transactionCount,
        sourceTransactionTotal: sourceSnapshot.transactionTotal,
        adjustmentReason: input.calculationMode === "AUTO" ? null : input.adjustmentReason,
        lastCalculatedAt: sourceSnapshot.capturedAt,
        lastCalculatedBy: input.calculationMode === "AUTO" ? "SYSTEM" : actorName || null,
      },
      select: SUMMARY_SELECT,
    });
    if (!existing) await captureFutureSourceLinks(row.id, input.date);
    await writeAuditLog({
      actorName,
      action: "DAILY_SALES_SUMMARY",
      entityType: "DailySalesSummary",
      entityId: row.id,
      entityLabel: input.date,
      summary: `${input.date} နေ့စဉ် လက်လီ/လက်ကား ရောင်းရငွေ ${ (input.retailTotal + input.wholesaleTotal).toLocaleString() } Ks`,
      metadata: input,
    });
    return NextResponse.json({ ok: true, data: await readSummary(input.date) });
  } catch (error) {
    const status = /မမှန်|မကျော်|Opening/.test(String(error.message || "")) ? 400 : 500;
    return NextResponse.json(databaseErrorResponse(error), { status });
  }
}
