import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDateInputValue, getMyanmarDayRange } from "@/lib/myanmar-time";
import { normalizeCashSaleType } from "@/lib/cash-sale-utils";

export const dynamic = "force-dynamic";

function toAmount(value) {
  const amount = Math.round(Number(value || 0));
  return Number.isFinite(amount) ? amount : 0;
}

function parseDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("ရက်စွဲပုံစံ မမှန်ပါ။");
  const range = getMyanmarDayRange(text);
  return { text, range };
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

function summarize(sales) {
  const summary = emptySummary();
  for (const sale of sales) {
    const amount = toAmount(sale.amount);
    const saleType = normalizeCashSaleType(sale.saleType);
    const paymentType = String(sale.paymentType || "CASH").trim().toUpperCase() || "CASH";
    summary.recordCount += 1;
    if (saleType === "WHOLESALE") summary.wholesaleTotal += amount;
    else summary.retailTotal += amount;
    if (paymentType === "CASH") {
      if (saleType === "WHOLESALE") summary.wholesaleCash += amount;
      else summary.retailCash += amount;
    }
    summary.paymentTypes[paymentType] = (summary.paymentTypes[paymentType] || 0) + amount;
  }
  summary.dailyTotal = summary.retailTotal + summary.wholesaleTotal;
  summary.cashDailyTotal = summary.retailCash + summary.wholesaleCash;
  return summary;
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const requestedDate = searchParams.get("date") || getMyanmarDateInputValue(new Date());
    const { text: date, range } = parseDate(requestedDate);
    const monthStart = getMyanmarDayRange(`${date.slice(0, 7)}-01`).start;

    const sales = await prisma.cashSale.findMany({
      where: { date: { gte: monthStart, lt: range.end } },
      select: { date: true, saleType: true, paymentType: true, amount: true },
      orderBy: [{ date: "asc" }],
    });
    const selectedSales = sales.filter((sale) => {
      const timestamp = new Date(sale.date).getTime();
      return timestamp >= range.start.getTime() && timestamp < range.end.getTime();
    });
    const byDate = new Map();
    for (const sale of sales) {
      const saleDate = getMyanmarDateInputValue(sale.date);
      const current = byDate.get(saleDate) || emptySummary();
      const next = summarize([sale]);
      for (const key of ["retailTotal", "wholesaleTotal", "dailyTotal", "retailCash", "wholesaleCash", "cashDailyTotal", "recordCount"]) current[key] += next[key];
      Object.entries(next.paymentTypes).forEach(([paymentType, amount]) => {
        current.paymentTypes[paymentType] = (current.paymentTypes[paymentType] || 0) + amount;
      });
      byDate.set(saleDate, current);
    }

    const selectedDay = summarize(selectedSales);
    const monthlyTotal = summarize(sales).dailyTotal;
    return NextResponse.json({
      ok: true,
      data: {
        date,
        selectedDay,
        monthlyTotal,
        byDate: Object.fromEntries(byDate),
        source: "CashSale",
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: error.message?.includes("ရက်စွဲ") ? 400 : 500 });
  }
}
