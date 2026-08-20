import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

export const AUTO_REPORT_STATUS_LIMIT = 20;

function safeErrorMessage(error) {
  const message = String(error?.message || "Auto report failed").replace(/\s+/g, " ").trim();
  if (/telegram/i.test(message)) return "Telegram သို့ ပို့ရာတွင် အမှားဖြစ်ပါသည်။";
  if (/database|prisma|postgres|supabase/i.test(message)) return "Server data service တွင် အမှားဖြစ်ပါသည်။";
  return message.replace(/https?:\/\/\S+/gi, "[hidden]").slice(0, 300);
}

function normalizeCounts(counts) {
  if (!counts || typeof counts !== "object") return null;
  return {
    paid: Number(counts.paid || 0),
    debtIncrease: Number(counts.debtIncrease || 0),
    transactions: Number(counts.transactions || 0),
    activityActions: Number(counts.activityActions || 0),
  };
}

export async function recordAutoReportRun({
  status,
  reportDate = null,
  periodLabel = null,
  counts = null,
  recipients = 0,
  elapsedMs = null,
  error = null,
} = {}) {
  try {
    await ensureDatabase();
    return await prisma.autoReportRun.create({
      data: {
        status: status === "SUCCESS" ? "SUCCESS" : "FAILED",
        trigger: "schedule",
        reportDate: reportDate || null,
        periodLabel: periodLabel || null,
        recipientCount: Math.max(0, Number(recipients || 0)),
        counts: normalizeCounts(counts) || undefined,
        elapsedMs: Number.isFinite(Number(elapsedMs)) ? Math.max(0, Math.round(Number(elapsedMs))) : null,
        errorMessage: status === "SUCCESS" ? null : safeErrorMessage(error),
      },
    });
  } catch (recordError) {
    // Monitoring must never turn a successful Telegram delivery into a failed cron response.
    console.error("Auto report status record failed", recordError);
    return null;
  }
}

export function serializeAutoReportRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    status: run.status,
    trigger: run.trigger,
    reportDate: run.reportDate,
    periodLabel: run.periodLabel,
    recipientCount: run.recipientCount,
    counts: run.counts || null,
    elapsedMs: run.elapsedMs,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt?.toISOString?.() || run.createdAt,
  };
}

export async function getAutoReportRuns(limit = AUTO_REPORT_STATUS_LIMIT) {
  await ensureDatabase();
  const safeLimit = Math.min(Math.max(Number(limit) || AUTO_REPORT_STATUS_LIMIT, 1), AUTO_REPORT_STATUS_LIMIT);
  const runs = await prisma.autoReportRun.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: safeLimit,
  });
  return runs.map(serializeAutoReportRun);
}
