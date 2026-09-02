import { getDailyReportData, createDailyReportPdf, createDailySummaryImage, createDailyActivityImage, createDailySalesSummaryImage } from "@/lib/daily-report";
import { sendDailyReportToTelegram } from "@/lib/telegram";
import { getMyanmarDayRange } from "@/lib/myanmar-time";
import { cashSaleTypeLabel } from "@/lib/cash-sale-utils";

export async function runDailyReport({ date, lateByDays = 0 } = {}) {
  const startedAt = Date.now();
  const report = await getDailyReportData(date ? getMyanmarDayRange(date) : undefined);
  const [pdfBuffer, imageBuffer, activityImageBuffer, salesSummaryImageBuffer] = await Promise.all([
    createDailyReportPdf(report),
    createDailySummaryImage(report),
    createDailyActivityImage(report),
    createDailySalesSummaryImage(report),
  ]);
  const activityCount = (report.activityLogs || []).length;
  const cashSaleTypeLines = Object.entries(report.summary.cashSaleTypes || {})
    .filter(([, detail]) => Number(detail?.count || 0) > 0)
    .map(([type, detail]) => `   • <b>${cashSaleTypeLabel(type)}</b> <code>${detail.count} ခု</code> <b>${Number(detail.amount || 0).toLocaleString()} ကျပ်</b>`);
  const normalizedLateByDays = Math.max(0, Math.floor(Number(lateByDays) || 0));
  const caption = [
    "<b>NEW LIFE LEDGER</b>",
    normalizedLateByDays > 0 ? `⚠️ <b>နောက်ကျ Catch-up Report</b> — scheduled run မဝင်သဖြင့် ${normalizedLateByDays} ရက်နောက်ကျ၍ ပို့ပါသည်။` : null,
    "<b>နေ့စဉ် လုပ်ငန်းစာရင်းချုပ်</b>",
    "",
    `<b>စာရင်းရက်စွဲ</b>\n<code>${report.dateLabel}</code>`,
    `<b>စာရင်းကာလ</b>\n<code>00:00–23:59 (မြန်မာစံတော်ချိန်)</code>`,
    "",
    `🟢 <b>ငွေချေ</b>  <code>${report.summary.paidCount} ခု</code>  <b>${report.summary.paidAmount.toLocaleString()} ကျပ်</b>`,
    `🔴 <b>အကြွေးတိုး</b>  <code>${report.summary.debtCount} ခု</code>  <b>${report.summary.debtAmount.toLocaleString()} ကျပ်</b>`,
    `🟣 <b>လက်ငင်းရောင်း</b>  <code>${report.summary.cashCount || 0} ခု</code>  <b>${(report.summary.cashAmount || 0).toLocaleString()} ကျပ်</b>`,
    ...cashSaleTypeLines,
    `🔵 <b>စုစုပေါင်းစာရင်း</b>  <code>${report.summary.totalTransactions} ခု</code>`,
    activityCount > 0 ? `🟣 <b>လုပ်ဆောင်ချက်မှတ်တမ်း</b>  <code>${activityCount} ခု</code>` : null,
    "",
    "📎 နေ့စဉ်စာရင်းချုပ်ပုံ၊ လုပ်ဆောင်ချက်မှတ်တမ်းပုံနှင့် PDF ဖိုင် ပူးတွဲပါရှိပါသည်။",
  ].filter(Boolean).join("\n");

  const delivery = await sendDailyReportToTelegram({
    pdfBuffer,
    imageBuffer,
    activityImageBuffer,
    salesSummaryImageBuffer,
    dateLabel: report.dateLabel,
    caption,
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
