import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDateInputValue, getMyanmarDayRange } from "@/lib/myanmar-time";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { normalizeCashSaleType } from "@/lib/cash-sale-utils";

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

function summarizeCashSales(sales) {
  const summary = emptySummary();
  for (const sale of sales) {
    const amount = toAmount(sale.amount);
    const saleType = normalizeCashSaleType(sale.saleType);
    const paymentType = String(sale.paymentType || CASH_PAYMENT_TYPE).trim().toUpperCase() || CASH_PAYMENT_TYPE;
    summary.recordCount += 1;
    if (saleType === "WHOLESALE") summary.wholesaleTotal += amount;
    else summary.retailTotal += amount;
    if (paymentType === CASH_PAYMENT_TYPE) {
      if (saleType === "WHOLESALE") summary.wholesaleCash += amount;
      else summary.retailCash += amount;
    }
    summary.paymentTypes[paymentType] = (summary.paymentTypes[paymentType] || 0) + amount;
  }
  summary.dailyTotal = summary.retailTotal + summary.wholesaleTotal;
  summary.cashDailyTotal = summary.retailCash + summary.wholesaleCash;
  return summary;
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

function serializeRow(date, summary, source, savedAt = null) {
  return { date, ...summary, source, savedAt };
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
  return {
    date,
    retailTotal,
    wholesaleTotal,
    retailCash,
    wholesaleCash,
    note: body.note?.trim() || null,
  };
}

async function readSummary(date) {
  const { range } = parseDate(date);
  const month = date.slice(0, 7);
  const monthStart = getMyanmarDayRange(`${month}-01`).start;
  const [cashSales, savedRows, opening] = await Promise.all([
    prisma.cashSale.findMany({
      where: { date: { gte: monthStart, lt: range.end } },
      select: { date: true, saleType: true, paymentType: true, amount: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
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
  const savedByDate = new Map(savedRows.map((row) => [row.date, row]));
  const selectedSaved = savedByDate.get(date);
  const selectedCash = summarizeCashSales(cashByDate.get(date) || []);
  const selectedDay = selectedSaved
    ? { ...summarizeSavedRow(selectedSaved), source: "DAILY_SUMMARY", savedAt: selectedSaved.updatedAt }
    : { ...selectedCash, source: selectedCash.recordCount ? "CASH_SALE" : "NONE", savedAt: null };

  const rows = new Map();
  for (const [rowDate, sales] of cashByDate.entries()) {
    rows.set(rowDate, serializeRow(rowDate, summarizeCashSales(sales), "CASH_SALE", null));
  }
  for (const row of savedRows) {
    rows.set(row.date, serializeRow(row.date, summarizeSavedRow(row), "DAILY_SUMMARY", row.updatedAt));
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
    const row = await prisma.dailySalesSummary.upsert({
      where: { date: input.date },
      update: {
        retailTotal: input.retailTotal,
        wholesaleTotal: input.wholesaleTotal,
        retailCash: input.retailCash,
        wholesaleCash: input.wholesaleCash,
        source: "DAILY_INPUT",
        note: input.note,
      },
      create: {
        date: input.date,
        retailTotal: input.retailTotal,
        wholesaleTotal: input.wholesaleTotal,
        retailCash: input.retailCash,
        wholesaleCash: input.wholesaleCash,
        source: "DAILY_INPUT",
        note: input.note,
      },
      select: SUMMARY_SELECT,
    });
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
