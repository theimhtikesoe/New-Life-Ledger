import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDayRange } from "@/lib/myanmar-time";
import { normalizeCashSaleType } from "@/lib/cash-sale-utils";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date") || getMyanmarDayRange().dateLabel;
    const { start, end } = getMyanmarDayRange(dateParam);

    // Keep these small aggregates sequential so one dashboard load uses one
    // database connection at a time on the production pool (limit: 5).
    const customerStats = await prisma.customer.aggregate({
      where: { deletedAt: null },
      _count: { _all: true },
      _sum: { current_balance: true },
    });
    const paymentStats = await prisma.ledger.aggregate({
      where: { date: { gte: start, lt: end }, type: "DEBIT" },
      _count: { _all: true },
      _sum: { amount: true },
    });
    const cashSaleGroups = await prisma.cashSale.groupBy({
      by: ["saleType"],
      where: { date: { gte: start, lt: end } },
      _count: { _all: true },
      _sum: { amount: true },
    });

    // Bottle sales are a secondary KPI. Read both ledger types in one query so
    // this card does not add a schema probe plus three extra round trips to the
    // dashboard's critical path. The migration is already part of deployment;
    // the catch below still keeps older databases from breaking the dashboard.
    let paidLedgers = [];
    let creditLedgers = [];
    let cashSalesForItems = [];
    try {
      const ledgerRows = typeof prisma.ledger.findMany === "function"
        ? await prisma.ledger.findMany({ where: { date: { gte: start, lt: end }, type: { in: ["DEBIT", "CREDIT"] } }, select: { type: true, saleItems: true } })
        : [];
      paidLedgers = ledgerRows.filter((row) => row.type === "DEBIT");
      creditLedgers = ledgerRows.filter((row) => row.type === "CREDIT");
      cashSalesForItems = typeof prisma.cashSale.findMany === "function"
        ? await prisma.cashSale.findMany({ where: { date: { gte: start, lt: end } }, select: { saleItems: true } })
        : [];
    } catch (error) {
      console.warn("Bottle sales KPI is unavailable until the saleItems migration is applied:", error?.message || error);
    }

    const collectSaleItems = (rows = []) => {
      const bottleItemMap = new Map();
      let totalBottles = 0;
      let totalBottleAmount = 0;
      rows.forEach((row) => {
        if (!Array.isArray(row.saleItems)) return;
        row.saleItems.forEach((item) => {
          const bottleCount = Math.max(0, Math.round(Number(item.bottleCount || 0)));
          const totalAmount = Math.max(0, Math.round(Number(item.totalAmount || 0)));
          if (!bottleCount && !totalAmount) return;
          const key = String(item.productKey || `${item.productName || "ဗူး"}::${item.capacity || 0}`);
          const current = bottleItemMap.get(key) || {
            productKey: key,
            categoryKey: item.categoryKey || null,
            productName: item.productName || "ဗူး",
            capacity: Number(item.capacity || 0),
            bottleCount: 0,
            totalAmount: 0,
          };
          current.bottleCount += bottleCount;
          current.totalAmount += totalAmount;
          bottleItemMap.set(key, current);
          totalBottles += bottleCount;
          totalBottleAmount += totalAmount;
        });
      });
      return { totalBottles, totalAmount: totalBottleAmount, items: [...bottleItemMap.values()].sort((a, b) => b.bottleCount - a.bottleCount) };
    };
    const bottleSales = collectSaleItems([...paidLedgers, ...cashSalesForItems]);
    const creditBottleSales = collectSaleItems(creditLedgers);

    const cashSales = cashSaleGroups.reduce((summary, group) => {
      const count = Number(group._count?._all || 0);
      const amount = Number(group._sum?.amount || 0);
      summary.count += count;
      summary.amount += amount;
      if (normalizeCashSaleType(group.saleType) === "WHOLESALE") {
        summary.wholesaleCount += count;
        summary.wholesaleAmount += amount;
      } else {
        summary.retailCount += count;
        summary.retailAmount += amount;
      }
      return summary;
    }, { count: 0, amount: 0, retailCount: 0, retailAmount: 0, wholesaleCount: 0, wholesaleAmount: 0 });

    return NextResponse.json({
      data: {
        date: dateParam,
        totalCustomers: Number(customerStats._count?._all || 0),
        totalBalance: Number(customerStats._sum?.current_balance || 0),
        todayPaidCount: Number(paymentStats._count?._all || 0),
        todayPaidAmount: Number(paymentStats._sum?.amount || 0),
        ...cashSales,
        bottleSales,
        creditBottleSales,
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
