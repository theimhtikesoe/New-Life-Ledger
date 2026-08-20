import { getDailyReportData, createDailyReportPdf, createDailySummaryImage, createDailyActivityImage } from "@/lib/daily-report";
import { sendDailyReportToTelegram } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";

export async function runDailyReport({ actorName = "System", trigger = "schedule" } = {}) {
  const startedAt = Date.now();
  const report = await getDailyReportData();
  const [pdfBuffer, imageBuffer, activityImageBuffer] = await Promise.all([
    createDailyReportPdf(report),
    createDailySummaryImage(report),
    createDailyActivityImage(report),
  ]);
  const caption = [
    "<b>NEW LIFE LEDGER</b>",
    "<b>DAILY BUSINESS REPORT</b>",
    "",
    `<b>REPORT DATE</b>\n<code>${report.dateLabel}</code>`,
    `<b>TIME RANGE</b>\n<code>00:00–23:59 (Myanmar Time)</code>`,
    `<b>DELIVERY</b>\n<code>08:00–10:00 Myanmar Time • Telegram Group</code>`,
    "",
    `🟢 <b>ငွေချေ</b>  <code>${report.summary.paidCount} ခု</code>  <b>${report.summary.paidAmount.toLocaleString()} Ks</b>`,
    `🔴 <b>အကြွေးတိုး</b>  <code>${report.summary.debtCount} ခု</code>  <b>${report.summary.debtAmount.toLocaleString()} Ks</b>`,
    `🔵 <b>Transactions</b>  <code>${report.summary.totalTransactions} ခု</code>`,
    `🟣 <b>Activity</b>  <code>${report.summary.auditCount} ခု</code>`,
    "",
    "📎 <b>FILES</b>  <code>Daily Summary PNG • Activity History PNG • 2-page PDF</code>",
  ].join("\n");

  const delivery = await sendDailyReportToTelegram({
    pdfBuffer,
    imageBuffer,
    activityImageBuffer,
    dateLabel: report.dateLabel,
    caption,
  });

  await prisma.auditLog.create({
    data: {
      actorName: actorName || "System",
      action: "DAILY_REPORT_SENT",
      entityType: "DailyReport",
      entityLabel: report.dateLabel,
      summary: `${trigger === "manual" ? "Manual" : "Scheduled"} daily report sent to Telegram group for ${report.dateLabel}`,
      metadata: {
        dateLabel: report.dateLabel,
        periodLabel: report.periodLabel,
        trigger,
        paidCount: report.summary.paidCount,
        debtCount: report.summary.debtCount,
        totalTransactions: report.summary.totalTransactions,
        auditCount: report.summary.auditCount,
        elapsedMs: Date.now() - startedAt,
        recipients: delivery.results.map((item) => item.chatId),
      },
    },
  });

  return {
    date: report.dateLabel,
    period: report.periodLabel,
    counts: {
      paid: report.summary.paidCount,
      debtIncrease: report.summary.debtCount,
      transactions: report.summary.totalTransactions,
      auditActions: report.summary.auditCount,
    },
    recipients: delivery.results.length,
    elapsedMs: Date.now() - startedAt,
  };
}
