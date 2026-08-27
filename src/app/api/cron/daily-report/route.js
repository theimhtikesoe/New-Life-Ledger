import { NextResponse } from "next/server";
import { runDailyReport } from "@/lib/daily-report-delivery";
import {
  beginAutoReportRun,
  claimManualReportNotice,
  finishAutoReportRun,
  finishManualReportNotice,
  releaseManualReportNotice,
} from "@/lib/auto-report-status";
import { getPreviousMyanmarDayRanges } from "@/lib/myanmar-time";
import { sendManualReportStatusNotice } from "@/lib/auto-report-notice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handleManualAlreadySent({ reportDate, run } = {}) {
  const claim = await claimManualReportNotice({ reportDate });
  if (!claim.shouldSend) {
    return { noticeSent: false, noticeReason: claim.reason };
  }

  try {
    const notice = await sendManualReportStatusNotice({ reportDate, run: claim.run || run });
    if (!notice.sent) {
      await releaseManualReportNotice({ runId: claim.runId });
      return { noticeSent: false, noticeReason: notice.reason };
    }
    const finished = await finishManualReportNotice({ runId: claim.runId });
    if (!finished) {
      // Keep the claim so a database write failure cannot cause repeated notices.
      return { noticeSent: true, noticeWarning: "notice_record_update_failed" };
    }
    return { noticeSent: true, noticeMessageId: notice.messageId };
  } catch (error) {
    // Do not release an ambiguous Telegram delivery claim: the request may
    // have reached Telegram before the network failed. Keeping the claim is
    // safer than sending a duplicate notice on the next cron invocation.
    console.error("Manual report status notice failed", error);
    return { noticeSent: false, noticeReason: "notice_delivery_failed" };
  }
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
      const manualAlreadySent = claim.reason === "already_success"
        && typeof claim.run?.trigger === "string"
        && claim.run.trigger.startsWith("manual");
      const notice = manualAlreadySent
        ? await handleManualAlreadySent({ reportDate: reportRange.dateLabel, run: claim.run })
        : null;
      results.push({
        date: reportRange.dateLabel,
        skipped: true,
        reason: claim.reason,
        ...(manualAlreadySent ? notice : {}),
      });
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
