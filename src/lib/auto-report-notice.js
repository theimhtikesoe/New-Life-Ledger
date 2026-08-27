import { sendTelegramTextToChat } from "@/lib/telegram";
import { formatMyanmarDateTime } from "@/lib/myanmar-time";

export async function sendManualReportStatusNotice({ reportDate, run } = {}) {
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID?.trim();
  if (!chatId) return { sent: false, reason: "telegram_group_not_configured" };

  const isMetadataReconciled = String(run?.trigger || "").startsWith("manual-reconciled");
  const notice = [
    "✅ <b>Auto Report အခြေအနေ</b>",
    `စာရင်းရက်စွဲ <code>${reportDate}</code> ကို Manual Report ဖြင့် ပို့ပြီးပါပြီ။`,
    "နောက် Auto scheduled run တွင် report အပြည့်ကို ထပ်မပို့ဘဲ Manual ပို့ပြီးကြောင်း status notice သာ ထားပါမည်။",
    "Duplicate report မဖြစ်စေရန် ဒီရက်စာကို Auto Report မှ skip လုပ်ပါမည်။",
    run?.createdAt && !isMetadataReconciled ? `Manual ပို့ချိန်: <code>${formatMyanmarDateTime(run.createdAt)} MMT</code>` : null,
  ].filter(Boolean).join("\n");

  const delivery = await sendTelegramTextToChat({ chatId, text: notice, parseMode: "HTML" });
  return { sent: true, messageId: delivery.messageId };
}
