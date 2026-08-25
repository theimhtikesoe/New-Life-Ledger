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

export async function editTelegramMessageText({ chatId, messageId, text, replyMarkup = undefined } = {}) {
  const { token } = getTelegramConfig();
  if (!token || !chatId || !messageId) throw new Error("Telegram edit message အချက်အလက် မပြည့်စုံသေးပါ။");
  return telegramRequest({
    token,
    method: "editMessageText",
    payload: {
      chat_id: String(chatId),
      message_id: Number(messageId),
      text: String(text || "").slice(0, 4000),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    },
  });
}

export function buildOrderDraftKeyboard(order, appUrl = "") {
  const id = String(order?.id || "");
  if (!id) return undefined;
  const url = appUrl ? `${String(appUrl).replace(/\/$/, "")}/orders?orderId=${encodeURIComponent(id)}` : "";
  return {
    inline_keyboard: [
      [{ text: "✅ Confirm (ချက်ချင်း)", callback_data: `order|confirm|I|${id}` }, { text: "📦 08:10 Batch", callback_data: `order|confirm|B|${id}` }],
      [{ text: "❌ Cancel", callback_data: `order|cancel|I|${id}` }],
      ...(url ? [[{ text: "🌐 Website တွင် ပြန်စစ်/ပြင်ရန်", url }]] : []),
    ],
  };
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

export async function setTelegramOrderWebhook({ url, secretToken } = {}) {
  const { token } = getTelegramConfig();
  if (!token || !url || !secretToken) throw new Error("Telegram webhook configuration မပြည့်စုံသေးပါ။");
  return telegramRequest({
    token,
    method: "setWebhook",
    payload: {
      url: String(url),
      secret_token: String(secretToken),
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    },
  });
}

export async function getTelegramWebhookInfo() {
  const { token } = getTelegramConfig();
  if (!token) throw new Error("Telegram token မပြည့်စုံသေးပါ။");
  const body = await telegramRequest({ token, method: "getWebhookInfo", payload: {} });
  return body.result || {};
}
