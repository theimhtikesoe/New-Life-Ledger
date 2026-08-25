import { NextResponse } from "next/server";
import { createOrderDraft, getOrderBySourceUpdateId } from "@/lib/order-service";
import { extractOrderFromText } from "@/lib/order-ai";
import { buildOrderDraftKeyboard, sendTelegramTextToChat, answerTelegramCallbackQuery } from "@/lib/telegram";
import { formatOrderDraftMessage } from "@/lib/order-utils";

export const dynamic = "force-dynamic";

function configuredOrderChatId() {
  return String(process.env.TELEGRAM_ORDER_GROUP_CHAT_ID || "").trim();
}

function isAuthorized(request) {
  const secret = String(process.env.TELEGRAM_ORDER_WEBHOOK_SECRET || "").trim();
  if (!secret) return false;
  return request.headers.get("x-telegram-bot-api-secret-token") === secret;
}

function isOrderTrigger(text) {
  const value = String(text || "").trim();
  return /^\/order(?:\s|$)/i.test(value) || /^မှာယူမှု(?:\s|$)/u.test(value);
}

function stripOrderTrigger(text) {
  return String(text || "").trim().replace(/^\/order\s*/i, "").replace(/^မှာယူမှု\s*/u, "").trim();
}

function safeErrorMessage(error) {
  const message = String(error?.message || "Order စစ်ဆေးရာတွင် အဆင်မပြေပါ။").replace(/\s+/g, " ").trim();
  if (/MANUS_AUTH|api key|credential/i.test(message)) return "Order AI key/permission အဆင်မပြေသေးပါ။ Website environment setting ကို ပြန်စစ်ပါ။";
  if (/timeout|အချိန်ကျော်/i.test(message)) return "Order AI အဖြေရရန် အချိန်ကျော်သွားပါပြီ။ ခဏနားပြီး ပြန်ပို့ပါ။";
  return message.slice(0, 240);
}

async function handleCallback(update) {
  const callback = update.callback_query;
  const chatId = String(callback?.message?.chat?.id || "");
  if (!configuredOrderChatId() || chatId !== configuredOrderChatId()) return { ok: true, ignored: "wrong_chat" };
  await answerTelegramCallbackQuery({ callbackQueryId: callback?.id, text: "Website မှ ပြန်စစ်ပြီး Confirm လုပ်ပါ။" });
  const data = String(callback?.data || "");
  const match = data.match(/^order\|(?:confirm|cancel)\|[^|]+\|([^|]+)$/);
  if (!match) return { ok: true, ignored: "unknown_callback" };
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (appUrl) {
    await sendTelegramTextToChat({ chatId, text: `ဒီ Order ကို Website မှာ ပြန်စစ်ပြီး Confirm/Cancel လုပ်ပါ။\n${appUrl}/orders?orderId=${encodeURIComponent(match[1])}` });
  }
  return { ok: true, status: "website_review_required" };
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized Telegram webhook request" }, { status: 401 });
  try {
    const update = await request.json();
    if (update?.callback_query) return NextResponse.json(await handleCallback(update));
    const message = update?.message;
    const chatId = String(message?.chat?.id || "");
    const orderChatId = configuredOrderChatId();
    if (!orderChatId || chatId !== orderChatId) return NextResponse.json({ ok: true, ignored: "not_order_group" });
    if (message?.from?.is_bot) return NextResponse.json({ ok: true, ignored: "bot_message" });
    if (!Number.isInteger(Number(update.update_id)) || !Number.isInteger(Number(message?.message_id))) return NextResponse.json({ ok: false, error: "Invalid Telegram update identity" }, { status: 400 });
    const text = String(message?.text || "").trim();
    if (!isOrderTrigger(text)) return NextResponse.json({ ok: true, ignored: "not_order_trigger" });
    const existing = await getOrderBySourceUpdateId(update.update_id);
    if (existing) return NextResponse.json({ ok: true, status: "duplicate", orderId: existing.id });
    const sourceText = stripOrderTrigger(text);
    if (!sourceText) {
      await sendTelegramTextToChat({ chatId, text: "Order အချက်အလက်ကို `မှာယူမှု` နောက်မှာ ရေးပေးပါ။ ဥပမာ — `မှာယူမှု မမိုး၊ 1 Liter၊ 100 ဘူးဆံ့ 5 ကဒ်၊ မြောက်ဒဂုံ၊ မနက်ဖြန်`", replyToMessageId: message.message_id });
      return NextResponse.json({ ok: true, status: "missing_text" });
    }

    let extracted;
    try {
      extracted = await extractOrderFromText(sourceText);
    } catch (error) {
      await sendTelegramTextToChat({ chatId, text: `⚠️ Order ကို AI နဲ့ ဖတ်မရသေးပါ။ ${safeErrorMessage(error)}`, replyToMessageId: message.message_id });
      return NextResponse.json({ ok: true, status: "ai_failed" });
    }
    const result = await createOrderDraft({
      sourceChatId: chatId,
      sourceMessageId: message.message_id,
      sourceUpdateId: update.update_id,
      sourceText,
      extracted,
    });
    const order = result.order;
    await sendTelegramTextToChat({
      chatId,
      text: result.duplicate ? `ℹ️ ဒီ Order ကို အရင်က Draft ဖန်တီးထားပြီးပါပြီ။\n\n${formatOrderDraftMessage(order)}` : formatOrderDraftMessage(order),
      replyMarkup: buildOrderDraftKeyboard(order, process.env.NEXT_PUBLIC_APP_URL),
      replyToMessageId: message.message_id,
    });
    return NextResponse.json({ ok: true, status: result.duplicate ? "duplicate" : "draft_created", orderId: order.id });
  } catch (error) {
    console.error("Telegram order webhook failed", error);
    return NextResponse.json({ ok: false, error: "Order webhook မအောင်မြင်ပါ။" }, { status: 500 });
  }
}
