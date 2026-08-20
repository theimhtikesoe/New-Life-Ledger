import { NextResponse } from "next/server";
import { getDailyReportData } from "@/lib/daily-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const report = await getDailyReportData();
    return NextResponse.json({
      ok: true,
      data: {
        date: report.dateLabel,
        period: report.periodLabel,
        summary: {
          paidCount: report.summary.paidCount,
          paidAmount: report.summary.paidAmount,
          debtCount: report.summary.debtCount,
          debtAmount: report.summary.debtAmount,
          totalTransactions: report.summary.totalTransactions,
          auditCount: report.summary.auditCount,
        },
      },
    });
  } catch (error) {
    console.error("Manual Telegram report preview failed", error);
    return NextResponse.json({ ok: false, error: error.message || "Report preview ရယူခြင်း မအောင်မြင်ပါ။" }, { status: 500 });
  }
}
