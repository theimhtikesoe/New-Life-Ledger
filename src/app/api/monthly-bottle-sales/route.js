import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDateInputValue, getMyanmarDayRange, getMyanmarDateParts } from "@/lib/myanmar-time";
import { hydrateSettledBottleSaleItems } from "@/lib/bottle-sales-ledger";
import { buildDailyBottleSalesSummary } from "@/lib/daily-bottle-sales";
import { DEFAULT_TUBE_MAPPINGS, getHistoricalBottleDisplayName, TUBE_PRODUCT_TYPES, serializeTubeTypes } from "@/lib/production-catalog";
import { loadCatalogWithCustomItems } from "@/lib/custom-catalog";

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
        productName: getHistoricalBottleDisplayName(item.productName),
        tubeType: serializeTubeTypes(item.tubeType || tubeMappings.get(String(item.productKey || ""))) || null,
      }))
      : row.saleItems,
  }));
}

function compactCustomerRows(customers = []) {
  const items = new Map();
  const compactCustomers = customers.map((row) => {
    for (const item of row.items || []) {
      const key = `${item.productKey}::${item.capacity}`;
      const current = items.get(key) || { ...item, cardCount: 0, bottleCount: 0, totalAmount: 0 };
      current.cardCount += Number(item.cardCount || 0);
      current.bottleCount += Number(item.bottleCount || 0);
      current.totalAmount += Number(item.totalAmount || 0);
      items.set(key, current);
    }
    return { customer: row.customer, totalPaidAmount: row.totalPaidAmount, totalBottles: row.totalBottles, totalAmount: row.totalAmount, transactions: row.transactions };
  });
  return { customers: compactCustomers, items: [...items.values()].sort((a, b) => b.bottleCount - a.bottleCount) };
}

function mergeCatalogItems(catalog = [], soldItems = [], tubeMappings = new Map()) {
  const merged = new Map(soldItems.map((item) => [`${item.productKey}::${item.capacity}`, item]));
  for (const item of catalog) {
    const key = `${item.productKey}::${item.capacity}`;
    if (merged.has(key)) continue;
    merged.set(key, {
      productKey: item.productKey,
      categoryKey: item.categoryKey || null,
      productName: item.productName,
      tubeType: serializeTubeTypes(tubeMappings.get(item.productKey)) || null,
      capacity: Number(item.capacity || 0),
      cardCount: 0,
      bottleCount: 0,
      totalAmount: 0,
    });
  }
  return [...merged.values()].sort((a, b) => b.bottleCount - a.bottleCount || String(a.productName).localeCompare(String(b.productName), "my") || Number(a.capacity || 0) - Number(b.capacity || 0));
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const params = new URL(request.url).searchParams;
    const compact = params.get("compact") === "1";
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
      const serializedTubeType = serializeTubeTypes(tubeType);
      tubeMappings.set(productKey, serializedTubeType);
      tubeBottleMap.set(productKey, { productKey, productName, capacity: Number(capacity), tubeType: serializedTubeType });
    }
    for (const row of mappingRows) {
      if (row.tubeType && !tubeMappings.has(row.productKey)) {
        const serializedTubeType = serializeTubeTypes(row.tubeType);
        tubeMappings.set(row.productKey, serializedTubeType);
        tubeBottleMap.set(row.productKey, { productKey: row.productKey, productName: row.productName, capacity: row.capacity, tubeType: serializedTubeType });
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
    const compactRows = compactCustomerRows(summary.customers);
    const catalog = await loadCatalogWithCustomItems();
    const itemSummary = mergeCatalogItems(catalog, compactRows.items, tubeMappings);
    return NextResponse.json({ data: {
      month,
      firstDate: first,
      totalCustomers: summary.totalCustomers,
      totalBottles: summary.totalBottles,
      totalAmount: summary.totalAmount,
      totalPaidAmount: summary.totalPaidAmount,
      totalDifference: summary.totalDifference,
      creditBottleSales: { totalBottles: summary.creditBottleSales.totalBottles },
      customers: compact ? compactRows.customers : summary.customers,
      items: itemSummary,
      daily,
      tubeTypes: TUBE_PRODUCT_TYPES,
      tubeBottleMappings: [...tubeBottleMap.values()],
    } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
