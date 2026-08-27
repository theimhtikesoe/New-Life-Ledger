import { NextResponse } from "next/server";
import { reconcileManualReportRun } from "@/lib/auto-report-status";
import { getMyanmarDayRange, getPreviousMyanmarDayRange } from "@/lib/myanmar-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

function isAuthorized(request) {
  const configuredPin = process.env.MANUAL_REPORT_PIN || process.env.CRON_SECRET;
  if (!configuredPin) return false;
  return request.headers.get("authorization") === `Bearer ${configuredPin}`;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "PIN code မှားနေပါသည် သို့မဟုတ် report PIN မသတ်မှတ်ရသေးပါ။" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const reportDate = body?.date || getPreviousMyanmarDayRange().dateLabel;
    getMyanmarDayRange(reportDate);
    const result = await reconcileManualReportRun({
      reportDate,
      periodLabel: body?.periodLabel || `${reportDate} (Manual ပို့ပြီးသား)`,
      counts: body?.counts || null,
      recipients: body?.recipients ?? 1,
    });
    return NextResponse.json({ ok: true, date: reportDate, ...result });
  } catch (error) {
    console.error("Manual report reconciliation failed", error);
    const invalidDate = /report date မမှန်ကန်ပါ/.test(String(error?.message || ""));
    return NextResponse.json(
      { error: invalidDate ? "ရွေးထားသော report date မမှန်ကန်ပါ။" : "Manual report status ကို ပြန်မှတ်၍ မရပါ။" },
      { status: invalidDate ? 400 : 500 },
    );
  }
}
