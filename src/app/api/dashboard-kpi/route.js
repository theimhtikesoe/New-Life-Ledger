import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getMyanmarDayRange } from "@/lib/myanmar-time";
import { normalizeCashSaleType } from "@/lib/cash-sale-utils";
import { aggregateStockMovements, loadCanonicalFactoryStockMovements } from "@/lib/factory-stock";
import { hydrateSettledBottleSaleItems } from "@/lib/bottle-sales-ledger";
import { buildDailyBottleSalesSummary } from "@/lib/daily-bottle-sales";
import { loadGlueStock } from "@/lib/glue-stock";

export const dynamic = "force-dynamic";
const DASHBOARD_KPI_CACHE_TTL_MS = 30_000;
const DASHBOARD_KPI_PAYLOAD_VERSION = 2;

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date") || getMyanmarDayRange().dateLabel;
    const forceRefresh = searchParams.has("refresh");
    const { start, end } = getMyanmarDayRange(dateParam);
    if (!forceRefresh) {
      const cached = await prisma.dashboardKpiSnapshot.findUnique({ where: { date: dateParam } });
      if (cached && cached.payload?.kpiVersion === DASHBOARD_KPI_PAYLOAD_VERSION && Date.now() - new Date(cached.generatedAt).getTime() < DASHBOARD_KPI_CACHE_TTL_MS) {
        return NextResponse.json({ data: cached.payload, cache: "hit", generatedAt: cached.generatedAt });
      }
    }
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
    // Dashboard stock cards must use the same canonical movement source as the
    // linked stock pages. Never compact by stockType/capacity alone: productKey
    // is part of the identity and stale persisted derived rows are excluded by
    // loadCanonicalFactoryStockMovements.
    const { movements: stockMovements } = typeof prisma.productionReport?.findMany === "function"
      ? await loadCanonicalFactoryStockMovements()
      : { movements: [] };
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
    const factoryTubePieces = factoryStockSummary
      .filter((item) => item.stockType === "TUBE")
      .reduce((sum, item) => sum + Number(item.currentBottles || 0), 0);
    const factoryTubePacks = factoryStockSummary
      .filter((item) => item.stockType === "TUBE")
      .reduce((sum, item) => {
        const capacity = Number(item.capacity || 0);
        const currentPieces = Math.max(0, Number(item.currentBottles || 0));
        return sum + (capacity ? currentPieces / capacity : 0);
      }, 0);
    const roundedFactoryTubePacks = Number(factoryTubePacks.toFixed(2));
    const glueStock = await loadGlueStock({ date: dateParam, includeMovements: false });
    const dayLedgers = await prisma.ledger.findMany({
      where: { ...dayWhere, type: "DEBIT" },
      select: { id: true, amount: true, date: true, type: true, saleItems: true, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { date: "desc" },
    });
    const settledLedgers = await hydrateSettledBottleSaleItems(prisma, dayLedgers);
    const creditLedgers = await prisma.ledger.findMany({
      where: { ...dayWhere, type: "CREDIT" },
      select: { id: true, amount: true, date: true, saleItems: true, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { date: "desc" },
    });
    const dayCashSales = await prisma.cashSale.findMany({
      where: dayWhere,
      select: { id: true, amount: true, date: true, saleItems: true, customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { date: "desc" },
    });
    const bottleSalesSummary = buildDailyBottleSalesSummary({ ledgers: settledLedgers, creditLedgers, cashSales: dayCashSales });
    const paidBottleSales = bottleSalesSummary.paidBottleSales;
    const cashBottleSales = bottleSalesSummary.cashBottleSales;
    const creditBottleSales = bottleSalesSummary.creditBottleSales;
    const totalBottleSales = {
      totalBottles: bottleSalesSummary.totalBottles,
      totalAmount: bottleSalesSummary.totalAmount,
      totalPaidAmount: bottleSalesSummary.totalPaidAmount,
      items: [...bottleSalesSummary.cashBottleSales.items, ...bottleSalesSummary.creditBottleSales.items],
    };
    // Keep the legacy bottleSales field as the cash-sale subset; the linked
    // daily-bottle-sales card uses totalBottleSales for cash plus credit sales.
    const bottleSales = cashBottleSales;

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

    const data = {
        date: dateParam,
        kpiVersion: DASHBOARD_KPI_PAYLOAD_VERSION,
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
        factoryTubePacks: roundedFactoryTubePacks,
        factoryGlueKg: glueStock.currentKg,
        factoryGlueBags: glueStock.currentBags,
        factoryGlueUsedTodayKg: glueStock.dailyUsedKg,
        factoryGlueUsedTodayBags: glueStock.dailyUsedBags,
        negativeBottleStockItems,
        negativeCapStockItems,
        negativeTubeStockItems,
      };
    await prisma.dashboardKpiSnapshot.upsert({
      where: { date: dateParam },
      create: { date: dateParam, payload: data },
      update: { payload: data, generatedAt: new Date() },
    });
    return NextResponse.json({ data, cache: "miss" });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
