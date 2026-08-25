import { NextResponse } from "next/server";
import { getTelegramOrderConfig, pinTelegramMessage, sendTelegramTextToChat } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function guideKeyboard() {
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (!appUrl) return undefined;
  return {
    inline_keyboard: [
      [{ text: "📝 Order ရေးနည်း", url: `${appUrl}/orders#telegram-order-guide` }],
      [{ text: "🌐 Website Orders ကြည့်ရန်", url: `${appUrl}/orders` }],
    ],
  };
}

function guideText() {
  return [
    "📌 New Life Order တင်ရန်",
    "",
    "Order တင်မည့်စာ၏ အစမှာ `မှာယူမှု` သို့မဟုတ် `/order` ကို ထည့်ရေးပါ။",
    "ပုံမှန် group စကားများကို Order အဖြစ် မဖတ်ပါ။",
    "",
    "ရေးရန်အချက်များ:",
    "Customer အမည်",
    "ဘူးအမျိုးအစား + Liter/ml + တစ်ကဒ်ဘူးအရေအတွက် + ကဒ်အရေအတွက်",
    "အဖုံးအမျိုးအစား (ရှိလျှင်) + ပုံမှန် pcs + အပို pcs",
    "ကားဂိတ်/နေရာ",
    "ဒီနေ့ သို့မဟုတ် မနက်ဖြန်",
    "",
    "ဥပမာ:",
    "မှာယူမှု ကံလီ",
    "0.3 Liter အပြာ",
    "400 ဆံ့ 20 ကဒ်",
    "အဖုံးပြာ 5000 pcs + အပို 20",
    "ပုလဲဂိတ်",
    "မနက်ဖြန်",
    "",
    "AI က Order ကို စစ်ပြီး Telegram မှာ Draft ပြန်ပြပါမယ်။ Confirm/Cancel ခလုတ်ကို group admin သာ နှိပ်နိုင်ပါမယ်။",
  ].join("\n");
}

export async function POST() {
  try {
    const { token, orderChatId } = getTelegramOrderConfig();
    if (!token || !orderChatId) return NextResponse.json({ ok: false, error: "Telegram Order group configuration မပြည့်စုံသေးပါ။" }, { status: 409 });
    const sent = await sendTelegramTextToChat({ chatId: orderChatId, text: guideText(), replyMarkup: guideKeyboard() });
    if (sent?.messageId) await pinTelegramMessage({ chatId: orderChatId, messageId: sent.messageId, disableNotification: false });
    return NextResponse.json({ ok: true, messageId: sent?.messageId || null, pinned: Boolean(sent?.messageId) });
  } catch (error) {
    console.error("Telegram Order guide publish failed", error);
    return NextResponse.json({ ok: false, error: "Telegram Order guide ပို့၍ မရသေးပါ။" }, { status: 500 });
  }
}
