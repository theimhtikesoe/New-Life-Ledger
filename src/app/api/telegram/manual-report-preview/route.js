import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDatabase } from "@/lib/database";
import { getMyanmarDayRange } from "@/lib/myanmar-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request) {
  try {
    const requestedDate = new URL(request.url).searchParams.get("date");
    const range = requestedDate ? getMyanmarDayRange(requestedDate) : undefined;
    if (!range) throw new Error("Report date မမှန်ကန်ပါ။");
    await ensureDatabase();
    const [ledgers, cashSales, auditCount, productionCount] = await Promise.all([
      prisma.ledger.findMany({ where: { date: { gte: range.start, lt: range.end } }, select: { type: true, amount: true } }),
      prisma.cashSale.findMany({ where: { date: { gte: range.start, lt: range.end } }, select: { amount: true } }),
      prisma.auditLog.count({ where: { createdAt: { gte: range.start, lt: range.end } } }),
      prisma.productionReport.count({ where: { reportDate: range.dateLabel } }),
    ]);
    const paid = ledgers.filter((row) => row.type === "DEBIT");
    const debt = ledgers.filter((row) => row.type !== "DEBIT");
    const paidAmount = paid.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const debtAmount = debt.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const cashAmount = cashSales.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return NextResponse.json({
      ok: true,
      data: {
        date: range.dateLabel,
        period: `${range.dateLabel} 00:00–23:59 (Myanmar time)`,
        summary: {
          paidCount: paid.length,
          paidAmount,
          debtCount: debt.length,
          debtAmount,
          cashCount: cashSales.length,
          cashAmount,
          cashPaymentTypes: {},
          cashSaleTypes: {},
          totalTransactions: ledgers.length,
          auditCount: auditCount + productionCount,
          activityCount: auditCount + productionCount,
        },
      },
    });
  } catch (error) {
    console.error("Manual Telegram report preview failed", error);
    const isInvalidDate = /report date မမှန်ကန်ပါ/.test(String(error?.message || ""));
    return NextResponse.json(
      { ok: false, error: error.message || "Report preview ရယူခြင်း မအောင်မြင်ပါ။" },
      { status: isInvalidDate ? 400 : 500 },
    );
  }
}
