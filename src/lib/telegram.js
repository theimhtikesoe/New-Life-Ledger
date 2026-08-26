function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID?.trim();
  const orderChatId = process.env.TELEGRAM_ORDER_GROUP_CHAT_ID?.trim();
  const factoryChatId = process.env.TELEGRAM_FACTORY_GROUP_CHAT_ID?.trim();
  return { token, groupChatId, orderChatId, factoryChatId };
}

async function telegramRequest({ token, method, payload }) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    throw new Error(`Telegram ${method} failed: ${response.status} ${body.description || "unknown error"}`);
  }
  return body;
}

async function sendTelegramFile({ token, chatId, method, buffer, filename, mimeType, caption }) {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption || "");
  if (caption) form.append("parse_mode", "HTML");
  if (method === "sendPhoto") {
    form.append("photo", new Blob([buffer], { type: mimeType }), filename);
  } else {
    form.append("document", new Blob([buffer], { type: mimeType }), filename);
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    throw new Error(`Telegram ${method} failed for ${chatId}: ${response.status} ${body.description || "unknown error"}`);
  }
  return body;
}

function splitTelegramText(value, maxLength = 3900) {
  const text = String(value || "");
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const boundary = remaining.lastIndexOf("\n", maxLength);
    const cut = boundary > 0 ? boundary : maxLength;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n+/, "");
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function sendTelegramTextToChat({ chatId, text, replyMarkup = undefined, replyToMessageId = null, parseMode = undefined } = {}) {
  const { token } = getTelegramConfig();
  if (!token || !chatId) throw new Error("Telegram token/chat ID မပြည့်စုံသေးပါ။");
  const chunks = splitTelegramText(text);
  const results = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const body = await telegramRequest({
      token,
      method: "sendMessage",
      payload: {
        chat_id: String(chatId),
        text: chunks[index],
        ...(parseMode ? { parse_mode: parseMode } : {}),
        ...(replyMarkup && index === chunks.length - 1 ? { reply_markup: replyMarkup } : {}),
        ...(replyToMessageId && index === 0 ? { reply_parameters: { message_id: Number(replyToMessageId) } } : {}),
      },
    });
    results.push({ messageId: body.result?.message_id, raw: body });
  }
  const last = results[results.length - 1] || {};
  return { chatId: String(chatId), messageId: last.messageId, messageIds: results.map((item) => item.messageId), raw: last.raw, results };
}

export async function answerTelegramCallbackQuery({ callbackQueryId, text = "", showAlert = false } = {}) {
  const { token } = getTelegramConfig();
  if (!token || !callbackQueryId) return { skipped: true };
  return telegramRequest({
    token,
    method: "answerCallbackQuery",
    payload: { callback_query_id: callbackQueryId, text: String(text || "").slice(0, 200), show_alert: Boolean(showAlert) },
  });
}

export async function getTelegramChatMember({ chatId, userId } = {}) {
  const { token } = getTelegramConfig();
  if (!token || !chatId || userId === null || userId === undefined) throw new Error("Telegram admin စစ်ရန် configuration မပြည့်စုံသေးပါ။");
  const body = await telegramRequest({ token, method: "getChatMember", payload: { chat_id: String(chatId), user_id: Number(userId) } });
  return body.result;
}

export function isTelegramOrderAdminStatus(status) {
  return ["administrator", "creator", "owner"].includes(String(status || "").toLowerCase());
}

export function configuredTelegramOrderAdminIds() {
  return String(process.env.TELEGRAM_ORDER_ADMIN_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function editTelegramMessageText({ chatId, messageId, text, replyMarkup = undefined, parseMode = undefined } = {}) {
  const { token } = getTelegramConfig();
  if (!token || !chatId || !messageId) throw new Error("Telegram edit message အချက်အလက် မပြည့်စုံသေးပါ။");
  return telegramRequest({
    token,
    method: "editMessageText",
    payload: {
      chat_id: String(chatId),
      message_id: Number(messageId),
      text: String(text || "").slice(0, 4000),
      ...(parseMode ? { parse_mode: parseMode } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    },
  });
}

export function buildOrderDraftKeyboard(order, appUrl = "") {
  return buildOrderActionKeyboard(order, appUrl);
}

export function buildOrderRetryKeyboard(order, appUrl = "") {
  const id = String(order?.id || "");
  if (!id) return undefined;
  return {
    inline_keyboard: [[{ text: "🔄 AI ပြန်စမ်းရန်", callback_data: `order|retry|I|${id}` }]],
  };
}

export function buildOrderMoreKeyboard(order, { includeBack = true } = {}) {
  const id = String(order?.id || "");
  if (!id) return undefined;
  const blocked = ["CONFIRMED", "BATCH_QUEUED", "FACTORY_NOTIFIED", "PREPARED", "COMPLETED", "CANCELLED"].includes(String(order?.status || ""));
  const rows = [];
  if (!blocked) rows.push([{ text: "📦 08:10 Batch ထည့်ရန်", callback_data: `order|confirm|B|${id}` }]);
  if (includeBack) rows.push([{ text: "⬅️ မူလခလုတ်များ", callback_data: `order|back|I|${id}` }]);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

export function buildOrderActionKeyboard(order, appUrl = "", { allowRetry = false } = {}) {
  const id = String(order?.id || "");
  if (!id) return undefined;
  const blocked = ["CONFIRMED", "BATCH_QUEUED", "FACTORY_NOTIFIED", "PREPARED", "COMPLETED", "CANCELLED"].includes(String(order?.status || ""));
  const missingFields = Array.isArray(order?.missingFields) ? order.missingFields : [];
  const blockingMissingFields = missingFields.filter((field) => !/^(?:Customer|ဖောက်သည်)/iu.test(String(field).trim()));
  const hasCustomer = Boolean(order?.customer?.id || order?.customerId);
  const canConfirm = !blocked && hasCustomer && blockingMissingFields.length === 0;
  const rows = [];
  if (canConfirm) {
    rows.push([{ text: "✅ Confirm", callback_data: `order|confirm|I|${id}` }]);
    rows.push([{ text: "❌ Cancel", callback_data: `order|cancel|I|${id}` }]);
  } else if (!blocked) {
    rows.push([{ text: "👤 ရှိပြီးသား Customer ချိတ်ရန်", callback_data: `order|customer|I|${id}` }]);
    rows.push([{ text: "➕ Customer အသစ်ဖန်တီးရန်", callback_data: `order|customer_create|I|${id}` }]);
    if (appUrl && missingFields.length) rows.push([{ text: "✏️ မသတ်မှတ်ရသေးတာ ဖြည့်ရန်", url: `${String(appUrl).replace(/\/$/, "")}/orders?orderId=${encodeURIComponent(id)}&edit=details` }]);
    rows.push([{ text: "❌ Cancel", callback_data: `order|cancel|I|${id}` }]);
  }
  return rows.length ? { inline_keyboard: rows } : undefined;
}

export function buildOrderCustomerCandidatesKeyboard(order, candidates = []) {
  const id = String(order?.id || "");
  if (!id) return undefined;
  const rows = candidates.slice(0, 8).map((candidate) => [{ text: `👤 ${String(candidate.name || "Customer").slice(0, 42)}`, callback_data: `order|link|I|${id}|${candidate.id}` }]);
  rows.push([{ text: "➕ Customer အသစ်ဖန်တီးရန်", callback_data: `order|customer_create|I|${id}` }]);
  rows.push([{ text: "⬅️ မူလခလုတ်များ", callback_data: `order|back|I|${id}` }]);
  return { inline_keyboard: rows };
}

export function buildOrderDoneKeyboard(orderId) {
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (!appUrl || !orderId) return undefined;
  return { inline_keyboard: [[{ text: "🌐 Website Order ကြည့်ရန်", url: `${appUrl.replace(/\/$/, "")}/orders?orderId=${encodeURIComponent(orderId)}` }]] };
}

export async function sendTelegramPlainTextMessage(message) {
  const { token, groupChatId } = getTelegramConfig();
  if (!token || !groupChatId) {
    throw new Error("Telegram configuration မပြည့်စုံသေးပါ။");
  }
  const result = await sendTelegramTextToChat({ chatId: groupChatId, text: message });
  return { results: [{ messageId: result.messageId }] };
}

export async function sendTelegramMessage(message) {
  const { token, groupChatId } = getTelegramConfig();
  if (!token || !groupChatId) {
    console.warn("Telegram group env vars are missing; skipping notification.");
    return { skipped: true };
  }
  const result = await sendTelegramTextToChat({ chatId: groupChatId, text: message, parseMode: "HTML" });
  return { results: [{ chatId: groupChatId, messageId: result.messageId }] };
}

export async function sendDailyReportToTelegram({ pdfBuffer, imageBuffer, activityImageBuffer, dateLabel, caption }) {
  const { token, groupChatId } = getTelegramConfig();
  if (!token || !groupChatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_GROUP_CHAT_ID are required");
  }
  const image = await sendTelegramFile({
    token,
    chatId: groupChatId,
    method: "sendPhoto",
    buffer: imageBuffer,
    filename: `new-life-ledger-${dateLabel}.png`,
    mimeType: "image/png",
    caption,
  });
  const activity = activityImageBuffer ? await sendTelegramFile({
    token,
    chatId: groupChatId,
    method: "sendPhoto",
    buffer: activityImageBuffer,
    filename: `new-life-ledger-${dateLabel}-activity.png`,
    mimeType: "image/png",
    caption: `📊 <b>လုပ်ဆောင်ချက်မှတ်တမ်း</b>\n<code>${dateLabel}</code>\n<code>မြန်မာစံတော်ချိန် 00:00–23:59</code>`,
  }) : null;
  const pdf = await sendTelegramFile({
    token,
    chatId: groupChatId,
    method: "sendDocument",
    buffer: pdfBuffer,
    filename: `New-Life-Ledger-Daily-${dateLabel}.pdf`,
    mimeType: "application/pdf",
    caption: `📄 <b>နေ့စဉ်စာရင်းချုပ် PDF</b>\n<code>${dateLabel}</code>\n<code>စာမျက်နှာ ၁ — နေ့စဉ်စာရင်းချုပ် • စာမျက်နှာ ၂ — လုပ်ဆောင်ချက်မှတ်တမ်း</code>`,
  });
  return { results: [{ chatId: groupChatId, imageMessageId: image.result?.message_id, activityImageMessageId: activity?.result?.message_id, pdfMessageId: pdf.result?.message_id }] };
}

export function telegramRecipientsConfigured() {
  const { token, groupChatId } = getTelegramConfig();
  return Boolean(token && groupChatId);
}

export function getTelegramOrderConfig() {
  const { token, orderChatId, factoryChatId } = getTelegramConfig();
  return { token, orderChatId, factoryChatId };
}

export async function pinTelegramMessage({ chatId, messageId, disableNotification = false } = {}) {
  const { token } = getTelegramConfig();
  if (!token || !chatId || !messageId) throw new Error("Telegram pin message အချက်အလက် မပြည့်စုံသေးပါ။");
  return telegramRequest({
    token,
    method: "pinChatMessage",
    payload: { chat_id: String(chatId), message_id: Number(messageId), disable_notification: Boolean(disableNotification) },
  });
}
