import { getDailyReportData, createDailyReportPdf, createDailySalesSummaryImage } from "@/lib/daily-report";
import { sendDailyReportToTelegram } from "@/lib/telegram";
import { getMyanmarDayRange } from "@/lib/myanmar-time";

export async function runDailyReport({ date, lateByDays = 0, recipientChatId = null } = {}) {
  const startedAt = Date.now();
  const report = await getDailyReportData(date ? getMyanmarDayRange(date) : undefined);
  const [pdfBuffer, salesSummaryImageBuffer] = await Promise.all([
    createDailyReportPdf(report),
    createDailySalesSummaryImage(report),
  ]);
  const activityCount = (report.activityLogs || []).length;
  const normalizedLateByDays = Math.max(0, Math.floor(Number(lateByDays) || 0));

  const delivery = await sendDailyReportToTelegram({
    pdfBuffer,
    salesSummaryImageBuffer,
    recipientChatId,
    dateLabel: report.dateLabel,
  });


  return {
    date: report.dateLabel,
    period: report.periodLabel,
    counts: {
      paid: report.summary.paidCount,
      debtIncrease: report.summary.debtCount,
      cashSales: report.summary.cashCount || 0,
      cashAmount: report.summary.cashAmount || 0,
      cashSaleTypes: report.summary.cashSaleTypes || {},
      transactions: report.summary.totalTransactions,
      auditActions: report.summary.auditCount,
      activityActions: activityCount,
    },
    recipients: delivery.results.length,
    elapsedMs: Date.now() - startedAt,
    lateByDays: normalizedLateByDays,
    catchUp: normalizedLateByDays > 0,
  };
}
