import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getWholesaleTracking, WHOLESALE_THRESHOLD_KS } from "@/lib/wholesale-tracking";

export const dynamic = "force-dynamic";

const TRACKING_LIMIT = 100;

export async function GET() {
  try {
    await ensureDatabase();

    const [ledgerRows, cashSaleRows] = await Promise.all([
      prisma.ledger.findMany({
        where: { amount: { gt: WHOLESALE_THRESHOLD_KS } },
        select: {
          id: true,
          customerId: true,
          customer: { select: { name: true } },
          type: true,
          saleType: true,
          amount: true,
          paymentType: true,
          date: true,
          note: true,
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: TRACKING_LIMIT,
      }),
      prisma.cashSale.findMany({
        where: { amount: { gt: WHOLESALE_THRESHOLD_KS } },
        select: {
          id: true,
          customerId: true,
          customer: { select: { name: true } },
          saleType: true,
          amount: true,
          paymentType: true,
          date: true,
          note: true,
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: TRACKING_LIMIT,
      }),
    ]);

    const ledgerRecords = ledgerRows.map((row) => ({
      ...row,
      recordType: "LEDGER",
      tracking: getWholesaleTracking(row.amount),
    }));
    const cashSaleRecords = cashSaleRows.map((row) => ({
      ...row,
      recordType: "CASH_SALE",
      type: "CASH_SALE",
      tracking: getWholesaleTracking(row.amount),
    }));
    const records = [...ledgerRecords, ...cashSaleRecords]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, TRACKING_LIMIT);

    return NextResponse.json({
      data: {
        thresholdKs: WHOLESALE_THRESHOLD_KS,
        rule: `amount > ${WHOLESALE_THRESHOLD_KS} Ks`,
        summary: {
          ledgerCount: ledgerRows.length,
          cashSaleCount: cashSaleRows.length,
          totalCount: ledgerRows.length + cashSaleRows.length,
          totalAmount: [...ledgerRows, ...cashSaleRows].reduce((sum, row) => sum + Number(row.amount || 0), 0),
        },
        records,
        limit: TRACKING_LIMIT,
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
