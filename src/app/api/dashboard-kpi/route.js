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

    const [customerStats, paymentStats, cashSaleGroups] = await Promise.all([
      prisma.customer.aggregate({
        where: { deletedAt: null },
        _count: { _all: true },
        _sum: { current_balance: true },
      }),
      prisma.ledger.aggregate({
        where: { date: { gte: start, lt: end }, type: "DEBIT" },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.cashSale.groupBy({
        by: ["saleType"],
        where: { date: { gte: start, lt: end } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      typeof prisma.ledger.findMany === "function" ? prisma.ledger.findMany({ where: { date: { gte: start, lt: end }, type: "CREDIT" }, select: { saleItems: true } }) : Promise.resolve([]),
      typeof prisma.cashSale.findMany === "function" ? prisma.cashSale.findMany({ where: { date: { gte: start, lt: end } }, select: { saleItems: true } }) : Promise.resolve([]),
    ]);

    const bottleItemMap = new Map();
    let totalBottles = 0;
    let totalBottleAmount = 0;
    const collectSaleItems = (rows = []) => {
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
    };
    collectSaleItems(creditLedgers);
    collectSaleItems(cashSalesForItems);

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
        bottleSales: {
          totalBottles,
          totalAmount: totalBottleAmount,
          items: [...bottleItemMap.values()].sort((a, b) => b.bottleCount - a.bottleCount),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
