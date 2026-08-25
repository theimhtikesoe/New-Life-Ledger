import { NextResponse } from "next/server";
import { createOrderDraft, getOrderById, getOrderBySourceUpdateId, refreshOrderFromAi, saveTelegramDraftMessage, updateOrderStatus } from "@/lib/order-service";
import { extractOrderFromText } from "@/lib/order-ai";
import {
  answerTelegramCallbackQuery,
  buildOrderDraftKeyboard,
  buildOrderRetryKeyboard,
  configuredTelegramOrderAdminIds,
  editTelegramMessageText,
  getTelegramChatMember,
  isTelegramOrderAdminStatus,
  sendTelegramTextToChat,
} from "@/lib/telegram";
import { buildFallbackOrderExtraction, formatOrderDraftMessage, isFallbackExtractionUsable } from "@/lib/order-utils";
import { sendFactoryNotificationForOrder } from "@/lib/order-delivery";

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
  return /^\/order(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(value) || /^မှာယူမှု(?:\s|[:၊,;.-]|$)/u.test(value);
}

function stripOrderTrigger(text) {
  return String(text || "").trim().replace(/^\/order(?:@[A-Za-z0-9_]+)?\s*/i, "").replace(/^မှာယူမှု(?:\s*[:၊,;.-]?\s*)/u, "").trim();
}

function safeErrorMessage(error) {
  const message = String(error?.message || "Order စစ်ဆေးရာတွင် အဆင်မပြေပါ။").replace(/\s+/g, " ").trim();
  if (/MANUS_AUTH|api key|credential/i.test(message)) return "Order AI key/permission အဆင်မပြေသေးပါ။ Website environment setting ကို ပြန်စစ်ပါ။";
  if (/timeout|အချိန်ကျော်/i.test(message)) return "Order AI အဖြေရရန် အချိန်ကျော်သွားပါပြီ။ ခဏနားပြီး ပြန်ပို့ပါ။";
  return message.slice(0, 240);
}

async function isAuthorizedOrderAdmin(chatId, userId) {
  const numericUserId = Number(userId);
  if (!chatId || !Number.isInteger(numericUserId)) return false;
  const configuredAdminIds = configuredTelegramOrderAdminIds();
  if (configuredAdminIds.length && !configuredAdminIds.includes(String(numericUserId))) return false;
  try {
    const member = await getTelegramChatMember({ chatId, userId: numericUserId });
    return isTelegramOrderAdminStatus(member?.status);
  } catch (error) {
    console.warn("Telegram order admin check failed", error);
    return false;
  }
}

function callbackAuditMetadata(callback) {
  return {
    source: "telegram_admin_callback",
    telegramUserId: callback?.from?.id == null ? null : String(callback.from.id),
    telegramUsername: callback?.from?.username ? String(callback.from.username).slice(0, 128) : null,
    telegramCallbackId: callback?.id ? String(callback.id).slice(0, 128) : null,
  };
}

async function handleCallback(update) {
  const callback = update.callback_query;
  const chatId = String(callback?.message?.chat?.id || "");
  if (!configuredOrderChatId() || chatId !== configuredOrderChatId()) return { ok: true, ignored: "wrong_chat" };
  const callbackUserId = callback?.from?.id;
  if (!(await isAuthorizedOrderAdmin(chatId, callbackUserId))) {
    await answerTelegramCallbackQuery({ callbackQueryId: callback?.id, text: "Group admin သာ Order ခလုတ်နှိပ်နိုင်ပါသည်။", showAlert: true });
    return { ok: true, ignored: "not_order_admin" };
  }
  const callbackMessageId = Number(callback?.message?.message_id);
  if (!Number.isInteger(callbackMessageId)) {
    await answerTelegramCallbackQuery({ callbackQueryId: callback?.id, text: "ဒီခလုတ် message ကို မတွေ့ပါ။", showAlert: true });
    return { ok: true, ignored: "missing_callback_message" };
  }
  const data = String(callback?.data || "");
  const match = data.match(/^order\|(confirm|cancel|retry)\|(I|B)\|([0-9a-f-]{36})$/i);
  if (!match) {
    await answerTelegramCallbackQuery({ callbackQueryId: callback?.id, text: "Order ခလုတ်အချက်အလက် မမှန်ပါ။", showAlert: true });
    return { ok: true, ignored: "unknown_callback" };
  }
  const [, action, modeCode, orderId] = match;
  const auditMetadata = callbackAuditMetadata(callback);
  const rememberCallbackMessage = async () => {
    try {
      await saveTelegramDraftMessage({ orderId, chatId, messageId: callbackMessageId });
    } catch (metadataError) {
      console.warn("Telegram callback message metadata save failed", metadataError);
    }
  };
  try {
    if (action.toLowerCase() === "retry") {
      const current = await getOrderById(orderId);
      if (!current) {
        await answerTelegramCallbackQuery({ callbackQueryId: callback?.id, text: "Order မတွေ့ပါ။", showAlert: true });
        return { ok: true, status: "missing_order", orderId };
      }
      try {
        const extracted = await extractOrderFromText(current.sourceText);
        const refreshed = await refreshOrderFromAi({ orderId, extracted, actorName: "Staff" });
        await rememberCallbackMessage();
        await answerTelegramCallbackQuery({ callbackQueryId: callback?.id, text: "AI ဖြင့် ပြန်စစ်ပြီးပါပြီ။" });
        await editTelegramMessageText({ chatId, messageId: callbackMessageId, text: `${formatOrderDraftMessage(refreshed)}\n\n🔄 Telegram admin မှ AI ဖြင့် ပြန်စစ်ပြီးပါပြီ။`, replyMarkup: buildOrderDraftKeyboard(refreshed, process.env.NEXT_PUBLIC_APP_URL) });
        return { ok: true, status: "ai_retried", orderId };
      } catch (retryError) {
        await answerTelegramCallbackQuery({ callbackQueryId: callback?.id, text: safeErrorMessage(retryError), showAlert: true });
        return { ok: true, status: "ai_retry_failed", orderId };
      }
    }
    if (action.toLowerCase() === "cancel") {
      const order = await updateOrderStatus({ orderId, status: "CANCELLED", actorName: "Staff", auditMetadata });
      await rememberCallbackMessage();
      await answerTelegramCallbackQuery({ callbackQueryId: callback?.id, text: "Order ကို Cancel လုပ်ပြီးပါပြီ။" });
      await editTelegramMessageText({ chatId, messageId: callbackMessageId, text: `${formatOrderDraftMessage(order)}\n\n❌ Telegram admin မှ Cancel လုပ်ပြီးပါပြီ။`, replyMarkup: { inline_keyboard: [] } });
      return { ok: true, status: "cancelled", orderId };
    }

    const isBatch = modeCode.toUpperCase() === "B";
    const status = isBatch ? "BATCH_QUEUED" : "CONFIRMED";
    const statusOrder = await updateOrderStatus({ orderId, status, mode: isBatch ? "MORNING_BATCH" : "IMMEDIATE", actorName: "Staff", auditMetadata });
    await rememberCallbackMessage();
    if (isBatch) {
      await answerTelegramCallbackQuery({ callbackQueryId: callback?.id, text: "08:10 morning batch ထဲ ထည့်ပြီးပါပြီ။" });
      await editTelegramMessageText({ chatId, messageId: callbackMessageId, text: `${formatOrderDraftMessage(statusOrder)}\n\n📦 Telegram admin မှ 08:10 morning batch ထဲ ထည့်ပြီးပါပြီ။`, replyMarkup: { inline_keyboard: [] } });
      return { ok: true, status: "batch_queued", orderId };
    }

    let finalOrder = statusOrder;
    let deliveryWarning = "";
    try {
      const delivery = await sendFactoryNotificationForOrder(orderId, { actorName: "Staff" });
      finalOrder = delivery.order || statusOrder;
      if (delivery.duplicate) deliveryWarning = "\n\nℹ️ Factory message ကို ထပ်မပို့ထားပါ။";
    } catch (deliveryError) {
      console.warn("Telegram admin immediate factory notification is pending", deliveryError);
      deliveryWarning = "\n\n⚠️ Order Confirm ဖြစ်ပါပြီ။ Factory group မသတ်မှတ်ရသေးခြင်း သို့မဟုတ် ပို့ရာတွင် အခက်အခဲရှိသောကြောင့် notification ကို Pending ထားပါသည်။";
    }
    await answerTelegramCallbackQuery({ callbackQueryId: callback?.id, text: deliveryWarning ? "Confirm ပြီးပါပြီ။ Factory notification Pending ဖြစ်နေပါသည်။" : "Confirm ပြီး Factory group သို့ ပို့ပြီးပါပြီ။" });
    await editTelegramMessageText({ chatId, messageId: callbackMessageId, text: `${formatOrderDraftMessage(finalOrder)}\n\n✅ Telegram admin မှ Confirm လုပ်ပြီးပါပြီ။${deliveryWarning}`, replyMarkup: { inline_keyboard: [] } });
    return { ok: true, status: "confirmed", orderId, deliveryPending: Boolean(deliveryWarning) };
  } catch (error) {
    await answerTelegramCallbackQuery({ callbackQueryId: callback?.id, text: safeErrorMessage(error), showAlert: true });
    return { ok: true, status: "action_failed", orderId };
  }
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
    const orderText = stripOrderTrigger(text);
    if (!orderText) {
      await sendTelegramTextToChat({ chatId, text: "Order အချက်အလက်ကို `မှာယူမှု` နောက်မှာ ရေးပေးပါ။ ဥပမာ — `မှာယူမှု မမိုး၊ 1 Liter၊ 100 ဘူးဆံ့ 5 ကဒ်၊ မြောက်ဒဂုံ၊ မနက်ဖြန်`", replyToMessageId: message.message_id });
      return NextResponse.json({ ok: true, status: "missing_text" });
    }

    const fallbackExtraction = buildFallbackOrderExtraction(orderText);
    const pending = await createOrderDraft({
      sourceChatId: chatId,
      sourceMessageId: message.message_id,
      sourceUpdateId: update.update_id,
      sourceText: text,
      extracted: fallbackExtraction,
    });
    if (pending.duplicate) return NextResponse.json({ ok: true, status: "duplicate", orderId: pending.order.id });

    if (isFallbackExtractionUsable(fallbackExtraction)) {
      const sentDraft = await sendTelegramTextToChat({
        chatId,
        text: formatOrderDraftMessage(pending.order),
        replyMarkup: buildOrderDraftKeyboard(pending.order, process.env.NEXT_PUBLIC_APP_URL),
        replyToMessageId: message.message_id,
      });
      if (sentDraft?.messageId) {
        try {
          await saveTelegramDraftMessage({ orderId: pending.order.id, chatId: sentDraft.chatId || chatId, messageId: sentDraft.messageId });
        } catch (metadataError) {
          console.warn("Telegram draft message metadata save failed", metadataError);
        }
      }
      return NextResponse.json({ ok: true, status: "draft_created", orderId: pending.order.id, aiSkipped: true });
    }

    try {
      const extracted = await extractOrderFromText(orderText);
      const order = await refreshOrderFromAi({ orderId: pending.order.id, extracted, actorName: "Staff" });
      const sentDraft = await sendTelegramTextToChat({
        chatId,
        text: formatOrderDraftMessage(order),
        replyMarkup: buildOrderDraftKeyboard(order, process.env.NEXT_PUBLIC_APP_URL),
        replyToMessageId: message.message_id,
      });
      if (sentDraft?.messageId) {
        try {
          await saveTelegramDraftMessage({ orderId: order.id, chatId: sentDraft.chatId || chatId, messageId: sentDraft.messageId });
        } catch (metadataError) {
          console.warn("Telegram draft message metadata save failed", metadataError);
        }
      }
      return NextResponse.json({ ok: true, status: "draft_created", orderId: order.id });
    } catch (error) {
      const fallbackMessage = await sendTelegramTextToChat({
        chatId,
        text: `⚠️ AI အဖြေ မရသေးပါ။ မူရင်းစာနှင့် ဖတ်မိသည့်အချက်များကို Draft အဖြစ် သိမ်းထားပါပြီ။\n${safeErrorMessage(error)}\n\n${formatOrderDraftMessage(pending.order, { includeActions: false })}\n\nအောက်က ခလုတ်ကိုနှိပ်ပြီး AI ကို ပြန်စမ်းနိုင်ပါတယ်။`,
        replyMarkup: buildOrderRetryKeyboard(pending.order, process.env.NEXT_PUBLIC_APP_URL),
        replyToMessageId: message.message_id,
      });
      if (fallbackMessage?.messageId) {
        try {
          await saveTelegramDraftMessage({ orderId: pending.order.id, chatId: fallbackMessage.chatId || chatId, messageId: fallbackMessage.messageId });
        } catch (metadataError) {
          console.warn("Telegram AI fallback message metadata save failed", metadataError);
        }
      }
      return NextResponse.json({ ok: true, status: "draft_ai_pending", orderId: pending.order.id });
    }
  } catch (error) {
    console.error("Telegram order webhook failed", error);
    return NextResponse.json({ ok: false, error: "Order webhook မအောင်မြင်ပါ။" }, { status: 500 });
  }
}
