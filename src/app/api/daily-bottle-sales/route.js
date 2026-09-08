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
    const productKey = String(item.productKey || `${item.productName || "ဗူး"}::${item.capacity || 0}`);
    const current = target.get(productKey) || {
      productKey,
      categoryKey: item.categoryKey || null,
      productName: item.productName || "ဗူး",
      capacity: Number(item.capacity || 0),
      bottleCount: 0,
      totalAmount: 0,
    };
    current.bottleCount += bottleCount;
    current.totalAmount += totalAmount;
    target.set(productKey, current);
  }
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

    const customerMap = new Map();
    for (const row of [...ledgers, ...cashSales]) {
      if (!Array.isArray(row.saleItems) || !row.saleItems.length) continue;
      const customer = row.customer || { id: "unknown", name: "Unknown", phone: null };
      const current = customerMap.get(customer.id) || {
        customer,
        totalBottles: 0,
        totalAmount: 0,
        totalPaidAmount: 0,
        items: new Map(),
        transactions: 0,
      };
      current.transactions += 1;
      addItems(current.items, row.saleItems);
      for (const item of row.saleItems) {
        current.totalBottles += Math.max(0, Math.round(Number(item?.bottleCount || 0)));
        current.totalAmount += Math.max(0, Math.round(Number(item?.totalAmount || 0)));
      }
      current.totalPaidAmount += Number.isFinite(Number(row.amount)) ? Math.max(0, Math.round(Number(row.amount))) : Math.max(0, current.totalAmount);
      customerMap.set(customer.id, current);
    }

    const customers = [...customerMap.values()]
      .map((entry) => ({ ...entry, difference: entry.totalAmount - entry.totalPaidAmount, items: [...entry.items.values()].sort((a, b) => b.bottleCount - a.bottleCount) }))
      .sort((a, b) => b.totalBottles - a.totalBottles);
    const creditItemMap = new Map();
    const creditCustomerMap = new Map();
    let creditTotalBottles = 0;
    let creditTotalAmount = 0;
    for (const row of creditLedgers) {
      if (!Array.isArray(row.saleItems)) continue;
      const customer = row.customer || { id: "unknown", name: "Unknown", phone: null };
      const customerEntry = creditCustomerMap.get(customer.id) || { customer, totalBottles: 0, totalAmount: 0, items: new Map() };
      addItems(creditItemMap, row.saleItems);
      addItems(customerEntry.items, row.saleItems);
      for (const item of row.saleItems) {
        const bottleCount = Math.max(0, Math.round(Number(item?.bottleCount || 0)));
        const totalAmount = Math.max(0, Math.round(Number(item?.totalAmount || 0)));
        creditTotalBottles += bottleCount;
        creditTotalAmount += totalAmount;
        customerEntry.totalBottles += bottleCount;
        customerEntry.totalAmount += totalAmount;
      }
      creditCustomerMap.set(customer.id, customerEntry);
    }
    return NextResponse.json({ data: {
      date,
      totalCustomers: customers.length,
      totalBottles: customers.reduce((sum, row) => sum + row.totalBottles, 0),
      totalAmount: customers.reduce((sum, row) => sum + row.totalAmount, 0),
      totalPaidAmount: customers.reduce((sum, row) => sum + row.totalPaidAmount, 0),
      totalDifference: customers.reduce((sum, row) => sum + (row.totalAmount - row.totalPaidAmount), 0),
      customers,
      creditBottleSales: {
        totalBottles: creditTotalBottles,
        totalAmount: creditTotalAmount,
        items: [...creditItemMap.values()].sort((a, b) => b.bottleCount - a.bottleCount),
        customers: [...creditCustomerMap.values()]
          .map((entry) => ({ ...entry, items: [...entry.items.values()].sort((a, b) => b.bottleCount - a.bottleCount) }))
          .sort((a, b) => b.totalBottles - a.totalBottles),
      },
    } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
