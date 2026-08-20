import { NextResponse } from "next/server";
import { runDailyReport } from "@/lib/daily-report-delivery";
import { recordAutoReportRun } from "@/lib/auto-report-status";
import { getPreviousMyanmarDayRange } from "@/lib/myanmar-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDailyReport({ trigger: "schedule" });
    await recordAutoReportRun({
      status: "SUCCESS",
      reportDate: result.date,
      periodLabel: result.period,
      counts: result.counts,
      recipients: result.recipients,
      elapsedMs: result.elapsedMs,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const fallbackReportDate = getPreviousMyanmarDayRange().dateLabel;
    await recordAutoReportRun({
      status: "FAILED",
      reportDate: fallbackReportDate,
      error,
    });
    console.error("Daily Telegram report failed", error);
    return NextResponse.json({ ok: false, error: error.message || "Daily report failed" }, { status: 500 });
  }
}

export async function GET(request) {
  return handle(request);
}

export async function POST(request) {
  return handle(request);
}
