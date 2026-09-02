import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function signedLedgerAmount(transaction) {
  return transaction.type === "CREDIT" ? transaction.amount : -transaction.amount;
}

export async function GET() {
  try {
    await ensureDatabase();

    const [customers, transactions, cashSales, kpayAliases, unverifiedKpay, auditLogs, orders, orderLines, orderCaps, orderDeliveries, orderAutomationSetting, orderBatchRuns, aiExplanationCaches, autoReportRuns, dailySalesSummaries, dailySalesSummarySources, dailySalesOpenings] = await Promise.all([
      prisma.customer.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          phone: true,
          routeTag: true,
          customerType: true,
          current_balance: true,
          createdAt: true,
          deletedAt: true,
        },
      }),
      prisma.ledger.findMany({
        orderBy: [{ date: "asc" }, { id: "asc" }],
        select: {
          id: true,
          customerId: true,
          date: true,
          type: true,
          saleType: true,
          itemSize: true,
          cartons: true,
          rate: true,
          deductions: true,
          amount: true,
          note: true,
          paymentType: true,
          createdAt: true,
        },
      }),
      prisma.cashSale.findMany({
        orderBy: [{ date: "asc" }, { id: "asc" }],
        select: {
          id: true,
          customerId: true,
          date: true,
          saleType: true,
          itemSize: true,
          cartons: true,
          rate: true,
          deductions: true,
          amount: true,
          note: true,
          paymentType: true,
          paymentBreakdown: true,
          createdAt: true,
        },
      }),
      prisma.kpayAlias.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          kpayName: true,
          customerId: true,
        },
      }),
      prisma.unverifiedKpay.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          raw_text: true,
          kpayName: true,
          amount: true,
          status: true,
          suggestedCustomerId: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          actorName: true,
          action: true,
          entityType: true,
          entityId: true,
          entityLabel: true,
          summary: true,
          metadata: true,
          hiddenAt: true,
          hiddenBy: true,
          createdAt: true,
        },
      }),
      prisma.order.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { customer: { select: { id: true, name: true } } } }),
      prisma.orderLine.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.orderCap.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.orderDelivery.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.orderAutomationSetting.findUnique({ where: { id: 1 } }),
      prisma.orderBatchRun.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.aiExplanationCache.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.autoReportRun.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.dailySalesSummary.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] }),
      prisma.dailySalesSummarySource.findMany({ orderBy: [{ linkedAt: "asc" }, { id: "asc" }] }),
      prisma.dailySalesOpening.findMany({ orderBy: [{ month: "asc" }, { id: "asc" }] }),
    ]);

    const ledgerTotals = new Map();
    for (const transaction of transactions) {
      ledgerTotals.set(
        transaction.customerId,
        (ledgerTotals.get(transaction.customerId) || 0) + signedLedgerAmount(transaction),
      );
    }

    const balanceMismatches = customers
      .map((customer) => {
        const storedBalance = customer.current_balance || 0;
        const recomputedBalance = ledgerTotals.get(customer.id) || 0;
        return {
          customerId: customer.id,
          name: customer.name,
          storedBalance,
          recomputedBalance,
          difference: storedBalance - recomputedBalance,
        };
      })
      .filter((item) => item.difference !== 0);

    const customerBalanceTotal = customers.reduce((sum, customer) => sum + (customer.current_balance || 0), 0);
    const transactionNetBalance = transactions.reduce((sum, transaction) => sum + signedLedgerAmount(transaction), 0);

    return NextResponse.json({
      data: {
        format: "new-life-ledger-backup",
        version: 6,
        generatedAt: new Date().toISOString(),
        counts: {
          customers: customers.length,
          transactions: transactions.length,
          cashSales: cashSales.length,
          kpayAliases: kpayAliases.length,
          unverifiedKpay: unverifiedKpay.length,
          auditLogs: auditLogs.length,
          orders: orders.length,
          orderLines: orderLines.length,
          orderCaps: orderCaps.length,
          orderDeliveries: orderDeliveries.length,
          orderBatchRuns: orderBatchRuns.length,
          orderAutomationSetting: orderAutomationSetting ? 1 : 0,
          aiExplanationCaches: aiExplanationCaches.length,
          autoReportRuns: autoReportRuns.length,
          dailySalesSummaries: dailySalesSummaries.length,
          dailySalesSummarySources: dailySalesSummarySources.length,
          dailySalesOpenings: dailySalesOpenings.length,
        },
        integrity: {
          algorithm: "Customer.current_balance = sum(CREDIT amounts) - sum(DEBIT amounts)",
          customerBalanceTotal,
          transactionNetBalance,
          totalDifference: customerBalanceTotal - transactionNetBalance,
          reconciledCustomers: customers.length - balanceMismatches.length,
          balanceMismatchCount: balanceMismatches.length,
          balanceMismatches,
          overpaymentHistory: "Derived from chronological Ledger CREDIT/DEBIT rows; no separate balance field is omitted.",
        },
        customers,
        transactions,
        cashSales,
        kpayAliases,
        unverifiedKpay,
        auditLogs,
        orders,
        orderLines,
        orderCaps,
        orderDeliveries,
        orderAutomationSetting,
        orderBatchRuns,
        aiExplanationCaches,
        autoReportRuns,
        dailySalesSummaries,
        dailySalesSummarySources,
        dailySalesOpenings,
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
