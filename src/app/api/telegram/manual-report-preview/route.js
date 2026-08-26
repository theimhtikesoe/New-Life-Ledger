import { NextResponse } from "next/server";
import { getDailyReportData } from "@/lib/daily-report";
import { getMyanmarDayRange } from "@/lib/myanmar-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request) {
  try {
    const requestedDate = new URL(request.url).searchParams.get("date");
    const range = requestedDate ? getMyanmarDayRange(requestedDate) : undefined;
    const report = await getDailyReportData(range);
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
          cashCount: report.summary.cashCount || 0,
          cashAmount: report.summary.cashAmount || 0,
          cashPaymentTypes: report.summary.cashPaymentTypes || {},
          cashSaleTypes: report.summary.cashSaleTypes || {},
          totalTransactions: report.summary.totalTransactions,
          auditCount: report.summary.auditCount,
          activityCount: report.summary.activityCount ?? report.activityLogs.length,
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
