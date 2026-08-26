import { NextResponse } from "next/server";
import { createCustomerForOrder, createOrderDraft, getOrderById, getOrderBySourceUpdateId, getOrderCustomerCandidates, linkOrderCustomer, refreshOrderFromAi, saveTelegramDraftMessage, updateOrderDetails, updateOrderStatus } from "@/lib/order-service";
import { extractOrderFromText } from "@/lib/order-ai";
import {
  answerTelegramCallbackQuery,
  buildOrderActionKeyboard,
  buildOrderCustomerCandidatesKeyboard,
  buildOrderMoreKeyboard,
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

async function editTelegramOrderMessage({ chatId, messageId, text, replyMarkup } = {}) {
  try {
    return await editTelegramMessageText({ chatId, messageId, text, parseMode: "Markdown", replyMarkup });
  } catch (error) {
    console.warn("Telegram Order Markdown edit failed; retrying plain text", error);
    return editTelegramMessageText({ chatId, messageId, text: String(text || "").replace(/```/g, ""), replyMarkup });
  }
}

async function editTelegramOrderMessageOrReply({ chatId, messageId, text, replyMarkup, replyToMessageId } = {}) {
  try {
    return await editTelegramOrderMessage({ chatId, messageId, text, replyMarkup });
  } catch (error) {
    if (/message is not modified/i.test(String(error?.message || ""))) return { unchanged: true };
    console.warn("Telegram Order message edit failed; sending a status reply", error);
    return sendTelegramTextToChat({
      chatId,
      replyToMessageId,
      text: String(text || "").replace(/```/g, ""),
      replyMarkup,
    });
  }
}

async function sendOrderProcessingNotice({ chatId, replyToMessageId } = {}) {
  try {
    await sendTelegramTextToChat({
      chatId,
      replyToMessageId,
      text: "⏳ Order စာကို စစ်နေပါသည်။ ခဏစောင့်ပေးပါ။ အဖြေကြာပါက မူရင်းစာကို Draft အဖြစ် မပျောက်အောင် သိမ်းထားပါမည်။",
    });
  } catch (noticeError) {
    console.warn("Telegram Order processing notice failed", noticeError);
  }
}

async function handleCallback(update) {
  const callback = update.callback_query;
  let callbackAcknowledged = false;
  const acknowledge = async (payload) => {
    if (callbackAcknowledged) return;
    callbackAcknowledged = true;
    try {
      await answerTelegramCallbackQuery(payload);
    } catch (error) {
      console.warn("Telegram callback acknowledgement failed", error);
    }
  };
  const chatId = String(callback?.message?.chat?.id || "");
  if (!configuredOrderChatId() || chatId !== configuredOrderChatId()) return { ok: true, ignored: "wrong_chat" };
  // Acknowledge before the network-bound admin permission check so Telegram
  // never keeps the button spinner running while getChatMember is pending.
  await acknowledge({ callbackQueryId: callback?.id, text: "လုပ်ဆောင်နေပါသည်။ ခဏစောင့်ပါ။" });
  const callbackUserId = callback?.from?.id;
  if (!(await isAuthorizedOrderAdmin(chatId, callbackUserId))) {
    await acknowledge({ callbackQueryId: callback?.id, text: "Group admin သာ Order ခလုတ်နှိပ်နိုင်ပါသည်။", showAlert: true });
    return { ok: true, ignored: "not_order_admin" };
  }
  const callbackMessageId = Number(callback?.message?.message_id);
  if (!Number.isInteger(callbackMessageId)) {
    await acknowledge({ callbackQueryId: callback?.id, text: "ဒီခလုတ် message ကို မတွေ့ပါ။", showAlert: true });
    return { ok: true, ignored: "missing_callback_message" };
  }
  const data = String(callback?.data || "");
  const match = data.match(/^order\|(confirm|cancel|retry|menu|back|customer|customer_create|link|ask_date|ask_destination|ask_phone)\|(I|B)\|([0-9a-f-]{36})(?:\|([0-9]{1,2}|[0-9a-f-]{36}))?$/i);
  if (!match) {
    await acknowledge({ callbackQueryId: callback?.id, text: "Order ခလုတ်အချက်အလက် မမှန်ပါ။", showAlert: true });
    return { ok: true, ignored: "unknown_callback" };
  }
  const [, action, modeCode, orderId, candidateId] = match;
  const auditMetadata = callbackAuditMetadata(callback);
  const rememberCallbackMessage = async () => {
    try {
      await saveTelegramDraftMessage({ orderId, chatId, messageId: callbackMessageId });
    } catch (metadataError) {
      console.warn("Telegram callback message metadata save failed", metadataError);
    }
  };
  try {
    if (action.toLowerCase() === "menu") {
      const order = await getOrderById(orderId);
      if (!order) {
        await acknowledge({ callbackQueryId: callback?.id, text: "Order မတွေ့ပါ။", showAlert: true });
        return { ok: true, status: "missing_order", orderId };
      }
      await acknowledge({ callbackQueryId: callback?.id, text: "အခြားလုပ်ဆောင်ချက်များကို ဖွင့်ပြီးပါပြီ။" });
      await editTelegramMessageText({ chatId, messageId: callbackMessageId, text: formatOrderDraftMessage(order), parseMode: "Markdown", replyMarkup: buildOrderMoreKeyboard(order) });
      return { ok: true, status: "menu_opened", orderId };
    }
    if (action.toLowerCase() === "back") {
      const order = await getOrderById(orderId);
      if (!order) {
        await acknowledge({ callbackQueryId: callback?.id, text: "Order မတွေ့ပါ။", showAlert: true });
        return { ok: true, status: "missing_order", orderId };
      }
      await acknowledge({ callbackQueryId: callback?.id, text: "မူလခလုတ်များကို ပြန်ဖွင့်ပြီးပါပြီ။" });
      await editTelegramMessageText({ chatId, messageId: callbackMessageId, text: formatOrderDraftMessage(order), parseMode: "Markdown", replyMarkup: buildOrderActionKeyboard(order, process.env.NEXT_PUBLIC_APP_URL) });
      return { ok: true, status: "menu_closed", orderId };
    }
    if (action.toLowerCase() === "customer") {
      const result = await getOrderCustomerCandidates({ orderId });
      const candidateCount = result.candidates.length;
      const selectionText = `${formatOrderDraftMessage(result.order)}\n\n${candidateCount ? "👤 ချိတ်မည့် Customer ကို ရွေးပါ။" : "⚠️ ဒီအမည်နှင့် ကိုက်ညီသော active Customer မတွေ့သေးပါ။ အောက်က Customer အသစ်ဖန်တီးရန်ကို ရွေးနိုင်ပါသည်။"}`;
      const replyMarkup = buildOrderCustomerCandidatesKeyboard(result.order, result.candidates);
      try {
        await editTelegramMessageText({ chatId, messageId: callbackMessageId, text: selectionText, parseMode: "Markdown", replyMarkup });
      } catch (editError) {
        // Some existing messages can fail Markdown parsing because customer/order text
        // contains Telegram-reserved characters. Retry the same callback without parse
        // mode so the admin still receives selectable Customer buttons.
        console.warn("Telegram Customer candidate Markdown edit failed; retrying plain text", editError);
        await editTelegramMessageText({ chatId, messageId: callbackMessageId, text: selectionText.replace(/```/g, ""), replyMarkup });
      }
      // The callback was already acknowledged immediately above.
      return { ok: true, status: "customer_candidates", orderId, candidateCount };
    }
    if (action.toLowerCase() === "link") {
      if (!candidateId) throw new Error("Customer ရွေးချယ်မှု မပြည့်စုံသေးပါ။");
      const result = await getOrderCustomerCandidates({ orderId });
      const candidateIndex = Number(candidateId);
      const candidate = Number.isInteger(candidateIndex) ? result.candidates[candidateIndex] : result.candidates.find((item) => String(item.id) === String(candidateId));
      if (!candidate) throw new Error("ရွေးထားသော Customer ကို မတွေ့ပါ။ ပြန်ရှာပြီး ရွေးပါ။");
      const linked = await linkOrderCustomer({ orderId, customerId: candidate.id, actorName: "Staff" });
      await rememberCallbackMessage();
      // The callback was already acknowledged immediately above.
      await editTelegramMessageText({ chatId, messageId: callbackMessageId, text: `${formatOrderDraftMessage(linked)}\n\n👤 Customer ချိတ်ပြီးပါပြီ။`, parseMode: "Markdown", replyMarkup: buildOrderActionKeyboard(linked, process.env.NEXT_PUBLIC_APP_URL) });
      return { ok: true, status: "customer_linked", orderId, customerId: candidate.id };
    }
    if (["ask_date", "ask_destination", "ask_phone"].includes(action.toLowerCase())) {
      const prompts = {
        ask_date: "📅 ထုတ်ရမည့်ရက်ကို ရေးပြီး ဒီစာကို Reply ပြန်ပါ။ ဥပမာ — 27.08.2026",
        ask_destination: "📍 ကားဂိတ်/နေရာကို ရေးပြီး ဒီစာကို Reply ပြန်ပါ။ ဥပမာ — တောင်ပေါ်ဂိတ်",
        ask_phone: "☎️ Customer ဖုန်းနံပါတ်ကို ရေးပြီး ဒီစာကို Reply ပြန်ပါ။",
      };
      // The callback was already acknowledged immediately above.
      await sendTelegramTextToChat({
        chatId,
        replyToMessageId: callbackMessageId,
        text: `${prompts[action.toLowerCase()]}\nOrder ID: ${orderId}`,
        replyMarkup: { force_reply: true, selective: true, input_field_placeholder: "ဒီနေရာမှာ ဖြည့်ပြီး Send လုပ်ပါ" },
      });
      return { ok: true, status: "missing_field_prompted", orderId, field: action.toLowerCase().replace("ask_", "") };
    }
    if (action.toLowerCase() === "customer_create") {
      const current = await getOrderById(orderId);
      if (!current) throw new Error("Order မတွေ့ပါ။");
      const created = await createCustomerForOrder({ orderId, name: current.draftCustomerName, phone: current.draftCustomerPhone, actorName: "Staff" });
      await rememberCallbackMessage();
      await editTelegramMessageText({ chatId, messageId: callbackMessageId, text: `${formatOrderDraftMessage(created)}\n\n📝 Order အတွက် Customer အမည်ကို သီးသန့်သိမ်းထားပါပြီ။ Main Customer/Ledger စာရင်းထဲ မထည့်ရသေးပါ။`, parseMode: "Markdown", replyMarkup: buildOrderActionKeyboard(created, process.env.NEXT_PUBLIC_APP_URL) });
      return { ok: true, status: "order_customer_draft_saved", orderId, customerId: null };
    }
    if (action.toLowerCase() === "retry") {
      const current = await getOrderById(orderId);
      if (!current) {
        await acknowledge({ callbackQueryId: callback?.id, text: "Order မတွေ့ပါ။", showAlert: true });
        return { ok: true, status: "missing_order", orderId };
      }
      // The callback was already acknowledged immediately above.
      try {
        const fallbackExtraction = buildFallbackOrderExtraction(current.sourceText);
        const extracted = isFallbackExtractionUsable(fallbackExtraction) ? fallbackExtraction : await extractOrderFromText(current.sourceText);
        const refreshed = await refreshOrderFromAi({ orderId, extracted, actorName: "Staff" });
        await rememberCallbackMessage();
        await editTelegramOrderMessage({ chatId, messageId: callbackMessageId, text: formatOrderDraftMessage(refreshed), replyMarkup: buildOrderActionKeyboard(refreshed, process.env.NEXT_PUBLIC_APP_URL) });
        return { ok: true, status: "ai_retried", orderId };
      } catch (retryError) {
        const retryMessage = formatOrderDraftMessage(current, { includeActions: false });
        await editTelegramOrderMessage({ chatId, messageId: callbackMessageId, text: retryMessage, replyMarkup: buildOrderActionKeyboard(current, process.env.NEXT_PUBLIC_APP_URL) });
        return { ok: true, status: "ai_retry_failed", orderId };
      }
    }
    if (action.toLowerCase() === "cancel") {
      const order = await updateOrderStatus({ orderId, status: "CANCELLED", actorName: "Staff", auditMetadata });
      await rememberCallbackMessage();
      // The callback was already acknowledged immediately above.
      await editTelegramOrderMessage({ chatId, messageId: callbackMessageId, text: `${formatOrderDraftMessage(order)}\n\n❌ Telegram admin မှ Cancel လုပ်ပြီးပါပြီ။`, replyMarkup: { inline_keyboard: [] } });
      return { ok: true, status: "cancelled", orderId };
    }

    const isBatch = modeCode.toUpperCase() === "B";
    const status = isBatch ? "BATCH_QUEUED" : "CONFIRMED";
    // Status transition continues after the immediate callback acknowledgement.
    const statusOrder = await updateOrderStatus({ orderId, status, mode: isBatch ? "MORNING_BATCH" : "IMMEDIATE", actorName: "Staff", auditMetadata });
    await rememberCallbackMessage();
    if (isBatch) {
      // The callback was already acknowledged immediately above.
      await editTelegramOrderMessage({ chatId, messageId: callbackMessageId, text: `${formatOrderDraftMessage(statusOrder)}\n\n📦 Telegram admin မှ 08:10 morning batch ထဲ ထည့်ပြီးပါပြီ။`, replyMarkup: { inline_keyboard: [] } });
      return { ok: true, status: "batch_queued", orderId };
    }

    let finalOrder = statusOrder;
    let deliveryWarning = "";
    // Reflect the durable Confirm state immediately; Factory delivery may be slower.
    await editTelegramOrderMessageOrReply({ chatId, messageId: callbackMessageId, replyToMessageId: callbackMessageId, text: `${formatOrderDraftMessage(statusOrder)}\n\n⏳ Confirm ဖြစ်ပြီး Factory group သို့ ပို့နေပါသည်။`, replyMarkup: { inline_keyboard: [] } });
    try {
      const delivery = await sendFactoryNotificationForOrder(orderId, { actorName: "Staff", source: "TELEGRAM" });
      finalOrder = delivery.order || statusOrder;
      if (delivery.duplicate) deliveryWarning = "\n\nℹ️ Factory message ကို ထပ်မပို့ထားပါ။";
    } catch (deliveryError) {
      console.warn("Telegram admin immediate factory notification is pending", deliveryError);
      deliveryWarning = "\n\n⚠️ Order Confirm ဖြစ်ပါပြီ။ Factory group မသတ်မှတ်ရသေးခြင်း သို့မဟုတ် ပို့ရာတွင် အခက်အခဲရှိသောကြောင့် notification ကို Pending ထားပါသည်။";
    }
    // The callback was already acknowledged immediately above.
    await editTelegramOrderMessageOrReply({ chatId, messageId: callbackMessageId, replyToMessageId: callbackMessageId, text: `${formatOrderDraftMessage(finalOrder)}\n\n✅ Telegram admin မှ Confirm လုပ်ပြီးပါပြီ။${deliveryWarning}`, replyMarkup: { inline_keyboard: [] } });
    return { ok: true, status: "confirmed", orderId, deliveryPending: Boolean(deliveryWarning) };
  } catch (error) {
    await acknowledge({ callbackQueryId: callback?.id, text: safeErrorMessage(error), showAlert: true });
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

    // Telegram-only completion: a reply to a field prompt updates the same Order row,
    // then refreshes the original Telegram draft message and its action buttons.
    const repliedText = String(message?.reply_to_message?.text || "");
    const promptMatch = repliedText.match(/Order ID:\s*([0-9a-f-]{36})/i);
    const promptFieldMatch = repliedText.match(/(ထုတ်ရမည့်ရက်|ကားဂိတ်\/နေရာ|Customer ဖုန်းနံပါတ်)/u);
    if (promptMatch && promptFieldMatch && text && await isAuthorizedOrderAdmin(chatId, message.from?.id)) {
      const promptOrderId = promptMatch[1];
      const promptField = promptFieldMatch[1];
      const updatePayload = promptField === "ထုတ်ရမည့်ရက်" ? { requestedDate: text } : promptField === "ကားဂိတ်/နေရာ" ? { destination: text } : { customerPhone: text };
      const updated = await updateOrderDetails({ orderId: promptOrderId, ...updatePayload, actorName: "Telegram Staff" });
      if (updated.telegramDraftChatId && updated.telegramDraftMessageId) {
        await editTelegramOrderMessageOrReply({ chatId: updated.telegramDraftChatId, messageId: Number(updated.telegramDraftMessageId), replyToMessageId: message.message_id, text: formatOrderDraftMessage(updated), replyMarkup: buildOrderActionKeyboard(updated, process.env.NEXT_PUBLIC_APP_URL) });
      }
      await sendTelegramTextToChat({ chatId, replyToMessageId: message.message_id, text: `✅ ${promptField} ဖြည့်ပြီးပါပြီ။ Order ကို ပြန်စစ်ပြီး Confirm လုပ်နိုင်ပါပြီ။` });
      return NextResponse.json({ ok: true, status: "missing_field_updated", orderId: promptOrderId, field: promptField });
    }
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
        parseMode: "Markdown",
        replyMarkup: buildOrderActionKeyboard(pending.order, process.env.NEXT_PUBLIC_APP_URL),
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

    // Always send the deterministic Draft first. AI enrichment must never block the
    // Telegram user from seeing the parsed order and its available actions.
    const sentDraft = await sendTelegramTextToChat({
      chatId,
      text: formatOrderDraftMessage(pending.order, { includeSource: true }),
      parseMode: "Markdown",
      replyMarkup: buildOrderActionKeyboard(pending.order, process.env.NEXT_PUBLIC_APP_URL),
      replyToMessageId: message.message_id,
    });
    if (sentDraft?.messageId) {
      try {
        await saveTelegramDraftMessage({ orderId: pending.order.id, chatId: sentDraft.chatId || chatId, messageId: sentDraft.messageId });
      } catch (metadataError) {
        console.warn("Telegram draft message metadata save failed", metadataError);
      }
    }

    try {
      const extracted = await extractOrderFromText(orderText);
      const order = await refreshOrderFromAi({ orderId: pending.order.id, extracted, actorName: "Staff" });
      if (sentDraft?.messageId) {
        await editTelegramOrderMessageOrReply({
          chatId: sentDraft.chatId || chatId,
          messageId: sentDraft.messageId,
          replyToMessageId: message.message_id,
          text: formatOrderDraftMessage(order, { includeSource: true }),
          replyMarkup: buildOrderActionKeyboard(order, process.env.NEXT_PUBLIC_APP_URL),
        });
      } else {
        await sendTelegramTextToChat({
          chatId,
          text: formatOrderDraftMessage(order, { includeSource: true }),
          parseMode: "Markdown",
          replyMarkup: buildOrderActionKeyboard(order, process.env.NEXT_PUBLIC_APP_URL),
          replyToMessageId: message.message_id,
        });
      }
      return NextResponse.json({ ok: true, status: "draft_created", orderId: order.id, aiEnriched: true });
    } catch (error) {
      // The deterministic Draft is already visible; leave it in place when AI is
      // unavailable instead of sending a second warning/error message.
      console.warn("Telegram Order AI enrichment skipped; deterministic Draft remains", safeErrorMessage(error));
      return NextResponse.json({ ok: true, status: "draft_created", orderId: pending.order.id, aiEnriched: false });
    }
  } catch (error) {
    console.error("Telegram order webhook failed", error);
    return NextResponse.json({ ok: false, error: "Order webhook မအောင်မြင်ပါ။" }, { status: 500 });
  }
}
