import { getDailyReportData, createDailyReportPdf, createDailySummaryImage, createDailyActivityImage } from "@/lib/daily-report";
import { sendDailyReportToTelegram } from "@/lib/telegram";
import { getMyanmarDayRange } from "@/lib/myanmar-time";

export async function runDailyReport({ date } = {}) {
  const startedAt = Date.now();
  const report = await getDailyReportData(date ? getMyanmarDayRange(date) : undefined);
  const [pdfBuffer, imageBuffer, activityImageBuffer] = await Promise.all([
    createDailyReportPdf(report),
    createDailySummaryImage(report),
    createDailyActivityImage(report),
  ]);
  const activityCount = (report.activityLogs || []).length;
  const caption = [
    "<b>NEW LIFE LEDGER</b>",
    "<b>နေ့စဉ် လုပ်ငန်းစာရင်းချုပ်</b>",
    "",
    `<b>စာရင်းရက်စွဲ</b>\n<code>${report.dateLabel}</code>`,
    `<b>စာရင်းကာလ</b>\n<code>00:00–23:59 (မြန်မာစံတော်ချိန်)</code>`,
    "",
    `🟢 <b>ငွေချေ</b>  <code>${report.summary.paidCount} ခု</code>  <b>${report.summary.paidAmount.toLocaleString()} ကျပ်</b>`,
    `🔴 <b>အကြွေးတိုး</b>  <code>${report.summary.debtCount} ခု</code>  <b>${report.summary.debtAmount.toLocaleString()} ကျပ်</b>`,
    `🔵 <b>စုစုပေါင်းစာရင်း</b>  <code>${report.summary.totalTransactions} ခု</code>`,
    activityCount > 0 ? `🟣 <b>လုပ်ဆောင်ချက်မှတ်တမ်း</b>  <code>${activityCount} ခု</code>` : null,
    "",
    "📎 နေ့စဉ်စာရင်းချုပ်ပုံ၊ လုပ်ဆောင်ချက်မှတ်တမ်းပုံနှင့် PDF ဖိုင် ပူးတွဲပါရှိပါသည်။",
  ].filter(Boolean).join("\n");

  const delivery = await sendDailyReportToTelegram({
    pdfBuffer,
    imageBuffer,
    activityImageBuffer,
    dateLabel: report.dateLabel,
    caption,
  });


  return {
    date: report.dateLabel,
    period: report.periodLabel,
    counts: {
      paid: report.summary.paidCount,
      debtIncrease: report.summary.debtCount,
      transactions: report.summary.totalTransactions,
      auditActions: report.summary.auditCount,
      activityActions: activityCount,
    },
    recipients: delivery.results.length,
    elapsedMs: Date.now() - startedAt,
  };
}
