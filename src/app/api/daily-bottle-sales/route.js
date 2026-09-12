import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDayRange } from "@/lib/myanmar-time";

export const dynamic = "force-dynamic";

function addItems(target, saleItems) {
  if (!Array.isArray(saleItems)) return;
  for (const item of saleItems) {
    const bottleCount = Math.max(0, Math.round(Number(item?.bottleCount || 0)));
    const totalAmount = Math.max(0, Math.round(Number(item?.totalAmount || 0)));
    if (!bottleCount && !totalAmount) continue;
    const capacity = Math.max(0, Math.round(Number(item?.capacity || 0)));
    const explicitCardCount = Number(item?.cardCount);
    const cardCount = Number.isFinite(explicitCardCount) && explicitCardCount > 0
      ? Math.round(explicitCardCount)
      : (capacity > 0 ? Math.round(bottleCount / capacity) : 0);
    // Capacity is part of the identity as well as productKey. This prevents
    // legacy/malformed rows with a reused productKey from being merged into
    // the wrong size line.
    const productKey = `${String(item.productKey || item.productName || "ဗူး")}::${capacity}`;
    const current = target.get(productKey) || {
      productKey,
      categoryKey: item.categoryKey || null,
      productName: item.productName || "ဗူး",
      capacity,
      cardCount: 0,
      bottleCount: 0,
      totalAmount: 0,
    };
    current.cardCount += cardCount;
    current.bottleCount += bottleCount;
    current.totalAmount += totalAmount;
    target.set(productKey, current);
  }
}

function buildCustomerRows(rows, { includeEmpty = false } = {}) {
  const customerMap = new Map();
  for (const row of rows) {
    if ((!Array.isArray(row.saleItems) || !row.saleItems.length) && !includeEmpty) continue;
    const customer = row.customer || { id: "unknown", name: "Unknown", phone: null };
    const current = customerMap.get(customer.id) || {
      customer,
      totalPaidAmount: 0,
      items: new Map(),
      transactions: 0,
    };
    current.transactions += 1;
        addItems(current.items, row.saleItems);
        const itemAmount = Array.isArray(row.saleItems)
          ? row.saleItems.reduce((sum, item) => sum + Math.max(0, Math.round(Number(item?.totalAmount || 0))), 0)
          : 0;
    current.totalPaidAmount += Number.isFinite(Number(row.amount)) ? Math.max(0, Math.round(Number(row.amount))) : itemAmount;
    customerMap.set(customer.id, current);
  }

  return [...customerMap.values()]
    .map((entry) => {
      const items = [...entry.items.values()].sort((a, b) => b.bottleCount - a.bottleCount);
      const totalBottles = items.reduce((sum, item) => sum + item.bottleCount, 0);
      const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
      const totalCards = items.reduce((sum, item) => sum + item.cardCount, 0);
      return { ...entry, totalCards, totalBottles, totalAmount, difference: totalAmount - entry.totalPaidAmount, items };
    })
    .sort((a, b) => b.totalBottles - a.totalBottles);
}

function summarizeRows(rows) {
  return {
    totalBottles: rows.reduce((sum, row) => sum + row.totalBottles, 0),
    totalAmount: rows.reduce((sum, row) => sum + row.totalAmount, 0),
    totalPaidAmount: rows.reduce((sum, row) => sum + row.totalPaidAmount, 0),
  };
}

function summarizeItems(rows) {
  const itemMap = new Map();
  for (const row of rows) addItems(itemMap, row.items);
  return [...itemMap.values()].sort((a, b) => b.bottleCount - a.bottleCount);
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const date = new URL(request.url).searchParams.get("date") || getMyanmarDayRange().dateLabel;
    const { start, end } = getMyanmarDayRange(date);
    const ledgers = await prisma.ledger.findMany({
      where: { date: { gte: start, lt: end }, type: "DEBIT" },
      select: { id: true, amount: true, date: true, saleType: true, saleItems: true, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { date: "asc" },
    });
    const creditLedgers = await prisma.ledger.findMany({
      where: { date: { gte: start, lt: end }, type: "CREDIT" },
      select: { id: true, amount: true, date: true, saleType: true, saleItems: true, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { date: "asc" },
    });
    const cashSales = await prisma.cashSale.findMany({
      where: { date: { gte: start, lt: end } },
      select: { id: true, amount: true, date: true, saleType: true, saleItems: true, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { date: "asc" },
    });

    const paidCustomers = buildCustomerRows(ledgers, { includeEmpty: true });
    const cashCustomers = buildCustomerRows(cashSales);
    const customers = buildCustomerRows([...ledgers, ...cashSales]);

    const creditItemMap = new Map();
    for (const row of creditLedgers) addItems(creditItemMap, row.saleItems);
    const creditCustomers = buildCustomerRows(creditLedgers).map(({ totalPaidAmount, difference, ...customer }) => customer);
    const creditSummary = summarizeRows(creditCustomers.map((row) => ({ ...row, totalPaidAmount: 0 })));
    const paidSummary = summarizeRows(paidCustomers);
    const cashSummary = summarizeRows(cashCustomers);
    const summary = summarizeRows(customers);
    const overallSummary = summarizeRows([...customers, ...creditCustomers]);

    return NextResponse.json({ data: {
      date,
      // Headline physical sales include cash, payment-linked, and debt-increase
      // rows. Debt-increase rows remain separated below for reconciliation.
      totalCustomers: new Set([...customers, ...creditCustomers].map((row) => row.customer.id)).size,
      totalBottles: overallSummary.totalBottles,
      totalAmount: overallSummary.totalAmount,
      totalPaidAmount: summary.totalPaidAmount,
      totalDifference: customers.reduce((sum, row) => sum + (row.totalAmount - row.totalPaidAmount), 0),
      customers,
      paidBottleSales: { ...paidSummary, customers: paidCustomers, items: summarizeItems(paidCustomers) },
      cashBottleSales: { ...cashSummary, customers: cashCustomers, items: summarizeItems(cashCustomers) },
      creditBottleSales: {
        totalBottles: creditSummary.totalBottles,
        totalAmount: creditSummary.totalAmount,
        items: [...creditItemMap.values()].sort((a, b) => b.bottleCount - a.bottleCount),
        customers: creditCustomers,
      },
    } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
