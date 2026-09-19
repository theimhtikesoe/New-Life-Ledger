import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDateInputValue, getMyanmarDayRange, getMyanmarDateParts } from "@/lib/myanmar-time";
import { hydrateSettledBottleSaleItems } from "@/lib/bottle-sales-ledger";
import { buildDailyBottleSalesSummary } from "@/lib/daily-bottle-sales";
import { DEFAULT_TUBE_MAPPINGS } from "@/lib/production-catalog";

export const dynamic = "force-dynamic";

function monthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("ရွေးထားသော လ မမှန်ကန်ပါ။");
  const [year, monthNumber] = month.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) throw new Error("ရွေးထားသော လ မမှန်ကန်ပါ။");
  const first = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const nextDate = new Date(Date.UTC(year, monthNumber, 1));
  const next = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const start = getMyanmarDayRange(first).start;
  const end = getMyanmarDayRange(next).start;
  return { start, end, first, next };
}

function rowDate(row) {
  return getMyanmarDateInputValue(row.date);
}

function enrichTubeTypes(rows, tubeMappings) {
  return rows.map((row) => ({
    ...row,
    saleItems: Array.isArray(row.saleItems)
      ? row.saleItems.map((item) => ({
        ...item,
        tubeType: item.tubeType || tubeMappings.get(String(item.productKey || "")) || null,
      }))
      : row.saleItems,
  }));
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const params = new URL(request.url).searchParams;
    const now = getMyanmarDateParts();
    const month = params.get("month") || `${now.year}-${String(now.month).padStart(2, "0")}`;
    const { start, end, first, next } = monthRange(month);
    const select = { id: true, amount: true, date: true, type: true, saleType: true, note: true, saleItems: true, customer: { select: { id: true, name: true, phone: true } } };
    const mappingRows = await prisma.priceSetting.findMany({
      where: { scope: "ITEM", priceDate: { lt: next } },
      select: { productKey: true, productName: true, capacity: true, tubeType: true, priceDate: true },
      orderBy: [{ priceDate: "desc" }, { updatedAt: "desc" }],
    });
    const tubeMappings = new Map();
    const tubeBottleMap = new Map();
    for (const [productKey, tubeType] of Object.entries(DEFAULT_TUBE_MAPPINGS)) {
      const [productName, capacity] = productKey.split("::");
      tubeMappings.set(productKey, tubeType);
      tubeBottleMap.set(productKey, { productKey, productName, capacity: Number(capacity), tubeType });
    }
    for (const row of mappingRows) {
      if (row.tubeType && !tubeMappings.has(row.productKey)) {
        tubeMappings.set(row.productKey, row.tubeType);
        tubeBottleMap.set(row.productKey, { productKey: row.productKey, productName: row.productName, capacity: row.capacity, tubeType: row.tubeType });
      }
    }
    let ledgers = await prisma.ledger.findMany({ where: { date: { gte: start, lt: end }, type: "DEBIT" }, select, orderBy: { date: "desc" } });
    ledgers = enrichTubeTypes(await hydrateSettledBottleSaleItems(prisma, ledgers), tubeMappings);
    const creditLedgers = await prisma.ledger.findMany({ where: { date: { gte: start, lt: end }, type: "CREDIT" }, select, orderBy: { date: "desc" } });
    const cashSales = await prisma.cashSale.findMany({ where: { date: { gte: start, lt: end } }, select: { id: true, amount: true, date: true, saleType: true, saleItems: true, customer: { select: { id: true, name: true, phone: true } } }, orderBy: { date: "desc" } });
    const enrichedCreditLedgers = enrichTubeTypes(creditLedgers, tubeMappings);
    const enrichedCashSales = enrichTubeTypes(cashSales, tubeMappings);
    const summary = buildDailyBottleSalesSummary({ ledgers, creditLedgers: enrichedCreditLedgers, cashSales: enrichedCashSales });
    const dates = new Set([...enrichedCashSales, ...enrichedCreditLedgers].map(rowDate));
    const daily = [...dates].sort().map((date) => {
      const day = buildDailyBottleSalesSummary({
        ledgers: ledgers.filter((row) => rowDate(row) === date),
        creditLedgers: enrichedCreditLedgers.filter((row) => rowDate(row) === date),
        cashSales: enrichedCashSales.filter((row) => rowDate(row) === date),
      });
      return { date, customers: day.totalCustomers, bottles: day.totalBottles, amount: day.totalAmount, paidAmount: day.totalPaidAmount, creditBottles: day.creditBottleSales.totalBottles };
    });
    return NextResponse.json({ data: { month, firstDate: first, ...summary, daily, items: [...summary.cashBottleSales.items, ...summary.creditBottleSales.items], tubeBottleMappings: [...tubeBottleMap.values()] } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
