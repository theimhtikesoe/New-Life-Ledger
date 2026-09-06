import { NextResponse } from "next/server";
import { runDailyReport } from "@/lib/daily-report-delivery";
import { beginAutoReportRun, finishAutoReportRun } from "@/lib/auto-report-status";
import { decodeActorHeader } from "@/lib/actor-header";
import { getMyanmarDayRange, getPreviousMyanmarDayRange } from "@/lib/myanmar-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request) {
  const authorization = request.headers.get("authorization");
  const configuredSecrets = [process.env.MANUAL_REPORT_PIN, process.env.CRON_SECRET, process.env.APP_PIN].filter(Boolean);
  return configuredSecrets.some((secret) => authorization === `Bearer ${secret}`);
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "PIN code မှားနေပါသည် သို့မဟုတ် report PIN မသတ်မှတ်ရသေးပါ။" }, { status: 401 });
  }

  try {
    const requestBody = await request.json().catch(() => ({}));
    const requestedDate = requestBody?.date;
    const recipientChatId = String(requestBody?.recipientChatId || "").trim() || null;
    if (recipientChatId && !/^-?\d+$/.test(recipientChatId)) {
      return NextResponse.json({ error: "Telegram recipient chat ID မမှန်ကန်ပါ။" }, { status: 400 });
    }
    const reportDate = requestedDate || getPreviousMyanmarDayRange().dateLabel;
    getMyanmarDayRange(reportDate);
    const actorName = decodeActorHeader(request.headers.get("x-actor-name")) || "Manual User";
    if (recipientChatId) {
      const result = await runDailyReport({ date: reportDate, recipientChatId });
      return NextResponse.json({ ok: true, testOnly: true, ...result, actorName });
    }
    const claim = await beginAutoReportRun({ reportDate, trigger: "manual" });
    if (!claim.shouldRun) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: claim.reason,
        date: reportDate,
        actorName,
      });
    }

    try {
      const result = await runDailyReport({ date: reportDate });
      await finishAutoReportRun({
        runId: claim.runId,
        status: "SUCCESS",
        reportDate: result.date,
        periodLabel: result.period,
        counts: result.counts,
        recipients: result.recipients,
        elapsedMs: result.elapsedMs,
      });
      return NextResponse.json({
        ok: true,
        ...result,
        actorName,
      });
    } catch (error) {
      await finishAutoReportRun({ runId: claim.runId, status: "FAILED", reportDate, error });
      throw error;
    }
  } catch (error) {
    console.error("Manual Telegram report failed", error);
    const isInvalidDate = /report date မမှန်ကန်ပါ/.test(String(error?.message || ""));
    return NextResponse.json(
      { ok: false, error: error.message || "Telegram report ပို့ခြင်း မအောင်မြင်ပါ။" },
      { status: isInvalidDate ? 400 : 500 },
    );
  }
}
