import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

export const AUTO_REPORT_STATUS_LIMIT = 20;
const RUNNING_TIMEOUT_MS = 15 * 60 * 1000;

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

export async function beginAutoReportRun({ reportDate, trigger = "schedule" } = {}) {
  if (!reportDate) throw new Error("Report date is required");
  await ensureDatabase();

  return prisma.$transaction(async (tx) => {
    // Serialize claims for the same report date across Vercel and GitHub retry invocations.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`new-life-ledger-report:${reportDate}`}))`;
    const latest = await tx.autoReportRun.findFirst({
      where: { reportDate },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    if (latest?.status === "SUCCESS") {
      return { shouldRun: false, reason: "already_success", run: serializeAutoReportRun(latest) };
    }

    if (latest?.status === "RUNNING" && Date.now() - new Date(latest.createdAt).getTime() < RUNNING_TIMEOUT_MS) {
      return { shouldRun: false, reason: "already_running", run: serializeAutoReportRun(latest) };
    }

    const run = await tx.autoReportRun.create({
      data: {
        status: "RUNNING",
        trigger,
        reportDate,
      },
    });
    return { shouldRun: true, runId: run.id, run: serializeAutoReportRun(run) };
  });
}

export async function claimManualReportNotice({ reportDate } = {}) {
  if (!reportDate) return { shouldSend: false, reason: "missing_report_date" };
  try {
    await ensureDatabase();
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`new-life-ledger-manual-notice:${reportDate}`}))`;
      const latest = await tx.autoReportRun.findFirst({
        where: { reportDate, status: "SUCCESS", trigger: { startsWith: "manual" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      if (!latest) return { shouldSend: false, reason: "manual_run_not_found" };
      if (latest.manualNoticeSentAt) return { shouldSend: false, reason: "notice_already_sent", run: serializeAutoReportRun(latest) };
      if (latest.manualNoticeClaimedAt) return { shouldSend: false, reason: "notice_already_claimed", run: serializeAutoReportRun(latest) };

      const claimedAt = new Date();
      const claimed = await tx.autoReportRun.updateMany({
        where: { id: latest.id, manualNoticeClaimedAt: null, manualNoticeSentAt: null },
        data: { manualNoticeClaimedAt: claimedAt },
      });
      if (claimed.count !== 1) return { shouldSend: false, reason: "notice_already_claimed", run: serializeAutoReportRun(latest) };
      return {
        shouldSend: true,
        runId: latest.id,
        run: serializeAutoReportRun({ ...latest, manualNoticeClaimedAt: claimedAt }),
      };
    });
  } catch (error) {
    console.error("Manual report notice claim failed", error);
    return { shouldSend: false, reason: "notice_claim_failed", error };
  }
}

export async function finishManualReportNotice({ runId } = {}) {
  if (!runId) return null;
  try {
    await ensureDatabase();
    return await prisma.autoReportRun.update({
      where: { id: runId },
      data: { manualNoticeSentAt: new Date() },
    });
  } catch (error) {
    console.error("Manual report notice completion failed", error);
    return null;
  }
}

export async function releaseManualReportNotice({ runId } = {}) {
  if (!runId) return null;
  try {
    await ensureDatabase();
    return await prisma.autoReportRun.updateMany({
      where: { id: runId, manualNoticeSentAt: null },
      data: { manualNoticeClaimedAt: null },
    });
  } catch (error) {
    console.error("Manual report notice release failed", error);
    return null;
  }
}

export async function reconcileManualReportRun({
  reportDate,
  periodLabel = null,
  counts = null,
  recipients = 1,
} = {}) {
  if (!reportDate) throw new Error("Report date is required");
  await ensureDatabase();

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`new-life-ledger-report:${reportDate}`}))`;
    const latest = await tx.autoReportRun.findFirst({
      where: { reportDate },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (latest?.status === "SUCCESS") {
      return { recorded: false, reason: "already_success", run: serializeAutoReportRun(latest) };
    }
    if (latest?.status === "RUNNING" && Date.now() - new Date(latest.createdAt).getTime() < RUNNING_TIMEOUT_MS) {
      return { recorded: false, reason: "already_running", run: serializeAutoReportRun(latest) };
    }

    const run = await tx.autoReportRun.create({
      data: {
        status: "SUCCESS",
        trigger: "manual-reconciled",
        reportDate,
        periodLabel,
        recipientCount: Math.max(0, Number(recipients || 0)),
        counts: normalizeCounts(counts) || undefined,
      },
    });
    return { recorded: true, run: serializeAutoReportRun(run) };
  });
}

export async function finishAutoReportRun({
  runId,
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
    if (runId) {
      return await prisma.autoReportRun.update({
        where: { id: runId },
        data: {
          status: status === "SUCCESS" ? "SUCCESS" : "FAILED",
          reportDate: reportDate || undefined,
          periodLabel: periodLabel || undefined,
          recipientCount: Math.max(0, Number(recipients || 0)),
          counts: normalizeCounts(counts) || undefined,
          elapsedMs: Number.isFinite(Number(elapsedMs)) ? Math.max(0, Math.round(Number(elapsedMs))) : null,
          errorMessage: status === "SUCCESS" ? null : safeErrorMessage(error),
        },
      });
    }

    return recordAutoReportRun({ status, reportDate, periodLabel, counts, recipients, elapsedMs, error, trigger: "schedule" });
  } catch (recordError) {
    // Monitoring must never turn a successful Telegram delivery into a failed cron response.
    console.error("Auto report status record failed", recordError);
    return null;
  }
}

export async function recordAutoReportRun({
  status,
  reportDate = null,
  periodLabel = null,
  counts = null,
  recipients = 0,
  elapsedMs = null,
  error = null,
  trigger = "schedule",
} = {}) {
  try {
    await ensureDatabase();
    return await prisma.autoReportRun.create({
      data: {
        status: status === "SUCCESS" ? "SUCCESS" : "FAILED",
        trigger,
        reportDate: reportDate || null,
        periodLabel: periodLabel || null,
        recipientCount: Math.max(0, Number(recipients || 0)),
        counts: normalizeCounts(counts) || undefined,
        elapsedMs: Number.isFinite(Number(elapsedMs)) ? Math.max(0, Math.round(Number(elapsedMs))) : null,
        errorMessage: status === "SUCCESS" ? null : safeErrorMessage(error),
      },
    });
  } catch (recordError) {
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
    manualNoticeClaimedAt: run.manualNoticeClaimedAt?.toISOString?.() || run.manualNoticeClaimedAt || null,
    manualNoticeSentAt: run.manualNoticeSentAt?.toISOString?.() || run.manualNoticeSentAt || null,
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
