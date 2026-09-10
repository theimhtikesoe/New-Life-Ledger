import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDayRange } from "@/lib/myanmar-time";
import { normalizeCashSaleType } from "@/lib/cash-sale-utils";
import { aggregateStockMovements, ensureFactoryStockTable, loadDerivedFactoryStockMovements } from "@/lib/factory-stock";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await ensureDatabase();
    await ensureFactoryStockTable();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date") || getMyanmarDayRange().dateLabel;
    const { start, end } = getMyanmarDayRange(dateParam);

    // The deployed database uses a small connection_limit. Keep this request
    // single-connection and sequential instead of making Promise.all contend
    // for a second connection during cold starts.
    const customerStats = await prisma.customer.aggregate({ where: { deletedAt: null }, _count: { _all: true }, _sum: { current_balance: true } });
    const paymentStats = await prisma.ledger.aggregate({ where: { date: { gte: start, lt: end }, type: "DEBIT" }, _count: { _all: true }, _sum: { amount: true } });
    const cashSaleGroups = await prisma.cashSale.groupBy({ by: ["saleType"], where: { date: { gte: start, lt: end } }, _count: { _all: true }, _sum: { amount: true } });
    const ledgerRows = typeof prisma.ledger.findMany === "function"
      ? await prisma.ledger.findMany({ where: { date: { gte: start, lt: end }, type: { in: ["DEBIT", "CREDIT"] } }, select: { type: true, amount: true, saleItems: true } })
      : [];
    const cashSalesForItems = typeof prisma.cashSale.findMany === "function"
      ? await prisma.cashSale.findMany({ where: { date: { gte: start, lt: end } }, select: { amount: true, saleItems: true } })
      : [];
    // Keep the dashboard KPI endpoint compatible with older generated clients
    // while the factory-stock table is being rolled out. A missing optional
    // model should show zero stock, not take down every dashboard KPI.
    const derivedStockMovements = typeof prisma.productionReport?.findMany === "function"
      ? await loadDerivedFactoryStockMovements()
      : [];
    let stockMovements = typeof prisma.factoryStockMovement?.findMany === "function"
      ? await prisma.factoryStockMovement.findMany({ select: { stockType: true, quantityCards: true } })
      : [];
    if (typeof prisma.productionReport?.findMany === "function") {
      const hasBottleMovements = stockMovements.some((movement) => movement.stockType !== "TUBE");
      if (!stockMovements.length) {
        stockMovements = derivedStockMovements;
      } else if (!hasBottleMovements) {
        stockMovements = [...stockMovements, ...derivedStockMovements.filter((movement) => movement.stockType !== "TUBE")];
      }
    }
    const factoryStockCards = stockMovements.filter((movement) => movement.stockType !== "TUBE").reduce((sum, movement) => sum + Number(movement.quantityCards || 0), 0);
    const factoryTubePieces = derivedStockMovements
      .filter((movement) => movement.stockType === "TUBE")
      .reduce((sum, movement) => sum + Number(movement.quantityBottles || 0), 0);
    const paidLedgers = ledgerRows.filter((row) => row.type === "DEBIT");
    const creditLedgers = ledgerRows.filter((row) => row.type === "CREDIT");

    const collectSaleItems = (rows = []) => {
      const bottleItemMap = new Map();
      let totalBottles = 0;
      let totalBottleAmount = 0;
      let totalPaidAmount = 0;
      rows.forEach((row) => {
        if (!Array.isArray(row.saleItems)) return;
        totalPaidAmount += Math.max(0, Math.round(Number(row.amount || 0)));
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
      return { totalBottles, totalAmount: totalBottleAmount, totalPaidAmount, items: [...bottleItemMap.values()].sort((a, b) => b.bottleCount - a.bottleCount) };
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
        factoryStockCards,
        factoryTubePieces,
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
