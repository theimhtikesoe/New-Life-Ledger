import { NextResponse } from "next/server";
import { runDailyReport } from "@/lib/daily-report-delivery";
import { beginAutoReportRun, finishAutoReportRun } from "@/lib/auto-report-status";
import { getPreviousMyanmarDayRanges } from "@/lib/myanmar-time";

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

  const reportRanges = getPreviousMyanmarDayRanges(new Date(), 3);
  const trigger = request.headers.get("x-vercel-cron-schedule") || "schedule";
  const results = [];

  for (let index = 0; index < reportRanges.length; index += 1) {
    const reportRange = reportRanges[index];
    const lateByDays = reportRanges.length - index - 1;
    const claim = await beginAutoReportRun({
      reportDate: reportRange.dateLabel,
      trigger: lateByDays > 0 ? `${trigger}:catch-up:${lateByDays}` : trigger,
    });

    if (!claim.shouldRun) {
      results.push({ date: reportRange.dateLabel, skipped: true, reason: claim.reason });
      continue;
    }

    try {
      const result = await runDailyReport({ date: reportRange.dateLabel, lateByDays });
      await finishAutoReportRun({
        runId: claim.runId,
        status: "SUCCESS",
        reportDate: result.date,
        periodLabel: result.period,
        counts: result.counts,
        recipients: result.recipients,
        elapsedMs: result.elapsedMs,
      });
      results.push({ date: result.date, sent: true, catchUp: result.catchUp, lateByDays: result.lateByDays, recipients: result.recipients });
    } catch (error) {
      await finishAutoReportRun({
        runId: claim.runId,
        status: "FAILED",
        reportDate: reportRange.dateLabel,
        error,
      });
      console.error("Daily Telegram report failed", error);
      return NextResponse.json({ ok: false, date: reportRange.dateLabel, results, error: error.message || "Daily report failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, results });
}

export async function GET(request) {
  return handle(request);
}

export async function POST(request) {
  return handle(request);
}
