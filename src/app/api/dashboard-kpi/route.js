import { NextResponse } from "next/server";
import { databaseErrorResponse } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDayRange } from "@/lib/myanmar-time";
import { normalizeCashSaleType } from "@/lib/cash-sale-utils";
import { aggregateStockMovements } from "@/lib/factory-stock";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date") || getMyanmarDayRange().dateLabel;
    const { start, end } = getMyanmarDayRange(dateParam);
    // Older form submissions stored a selected Myanmar date as 00:00 UTC.
    // Include that exact legacy timestamp so existing activity records still
    // appear in today's KPI after the date-storage fix is deployed.
    const legacyDateStart = new Date(`${dateParam}T00:00:00.000Z`);
    const dayWhere = { OR: [{ date: { gte: start, lt: end } }, { date: legacyDateStart }] };

    // The deployed database uses a small connection_limit. Keep this request
    // single-connection and sequential instead of making Promise.all contend
    // for a second connection during cold starts.
    const customerStats = await prisma.customer.aggregate({ where: { deletedAt: null }, _count: { _all: true }, _sum: { current_balance: true } });
    const paymentStats = await prisma.ledger.aggregate({ where: { ...dayWhere, type: "DEBIT" }, _count: { _all: true }, _sum: { amount: true } });
    const cashSaleGroups = await prisma.cashSale.groupBy({ by: ["saleType"], where: dayWhere, _count: { _all: true }, _sum: { amount: true } });
    // Keep the dashboard KPI endpoint compatible with older generated clients
    // while the factory-stock table is being rolled out. A missing optional
    // model should show zero stock, not take down every dashboard KPI.
    // The main KPI request must stay light. Rebuilding derived stock from the
    // complete production/ledger/cash-sale history here makes every dashboard
    // open wait on a large historical scan. Detailed stock pages still perform
    // the canonical rebuild when they are opened.
    const stockMovements = typeof prisma.factoryStockMovement?.groupBy === "function"
      ? (await prisma.factoryStockMovement.groupBy({
        by: ["productKey", "productName", "stockType", "capacity", "movementType"],
        _sum: { quantityCards: true, quantityBottles: true },
      })).map((row) => ({
        productKey: row.productKey,
        productName: row.productName,
        stockType: row.stockType,
        capacity: row.capacity,
        movementType: row.movementType,
        quantityCards: row._sum?.quantityCards || 0,
        quantityBottles: row._sum?.quantityBottles || 0,
      }))
      : [];
    const factoryStockSummary = aggregateStockMovements(stockMovements);
    const negativeBottleStockItems = factoryStockSummary.filter((item) => item.stockType === "BOTTLE" && Number(item.currentCards || 0) < 0).length;
    const negativeCapStockItems = factoryStockSummary.filter((item) => item.stockType === "CAP" && Number(item.capacity || 0) > 0 && Number(item.currentCards || 0) < 0).length;
    const negativeTubeStockItems = factoryStockSummary.filter((item) => item.stockType === "TUBE" && Number(item.currentBottles || 0) < 0).length;
    // Keep Tube stock out of the bottle KPI: factoryStockSummary.filter((item) => item.stockType !== "TUBE")
    const factoryStockCards = factoryStockSummary.filter((item) => item.stockType === "BOTTLE").reduce((sum, item) => sum + Number(item.currentCards || 0), 0);
    // Match the Cap Stock page: only configured cap packs represent physical
    // stock. Legacy color-only rows with capacity 0 are not part of Net Stock
    // Change and must not change the Dashboard KPI.
    const factoryCapPieces = factoryStockSummary
      .filter((item) => item.stockType === "CAP" && Number(item.capacity || 0) > 0)
      .reduce((sum, item) => sum + Number(item.currentCards || 0), 0);
    const factoryTubePieces = stockMovements
      .filter((movement) => movement.stockType === "TUBE")
      .reduce((sum, movement) => sum + Number(movement.quantityBottles || 0), 0);
    const factoryTubePacks = factoryStockSummary
      .filter((item) => item.stockType === "TUBE")
      .reduce((sum, item) => {
        const capacity = Number(item.capacity || 0);
        return sum + (capacity ? (Number(item.currentBottles || 0) < 0 ? -Math.ceil(Math.abs(Number(item.currentBottles || 0)) / capacity) : Math.floor(Number(item.currentBottles || 0) / capacity)) : 0);
      }, 0);
    // Item-level sale details are intentionally omitted here. Loading JSON
    // saleItems for every daily ledger/cash-sale row made this KPI endpoint
    // scan a large payload on every dashboard open. Detail pages still load
    // the canonical item breakdown when the user opens them.
    const paidBottleSales = { totalBottles: 0, totalAmount: 0, totalPaidAmount: 0, items: [] };
    const cashBottleSales = { totalBottles: 0, totalAmount: 0, totalPaidAmount: 0, items: [] };
    const bottleSales = { totalBottles: 0, totalAmount: 0, totalPaidAmount: 0, items: [] };
    const creditBottleSales = { totalBottles: 0, totalAmount: 0, totalPaidAmount: 0, items: [] };
    const totalBottleSales = { ...bottleSales };

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
        paidBottleSales,
        cashBottleSales,
        bottleSales,
        totalBottleSales,
        creditBottleSales,
        factoryStockCards,
        factoryCapPieces,
        factoryTubePieces,
        factoryTubePacks,
        negativeBottleStockItems,
        negativeCapStockItems,
        negativeTubeStockItems,
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
