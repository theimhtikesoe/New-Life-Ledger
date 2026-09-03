function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID?.trim();
  const orderChatId = process.env.TELEGRAM_ORDER_GROUP_CHAT_ID?.trim();
  const factoryChatId = process.env.TELEGRAM_FACTORY_GROUP_CHAT_ID?.trim();
  return { token, groupChatId, orderChatId, factoryChatId };
}

async function telegramRequest({ token, method, payload, timeoutMs = 8000, maxAttempts = 2 }) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        const error = new Error(`Telegram ${method} failed: ${response.status} ${body.description || "unknown error"}`);
        error.retryable = response.status >= 500 || response.status === 429;
        throw error;
      }
      return body;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || (error?.name !== "AbortError" && !error?.retryable)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error(`Telegram ${method} failed`);
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
    timeoutMs: 4000,
    maxAttempts: 1,
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

export function buildOrderDateKeyboard(order, { includeBack = true } = {}) {
  const id = String(order?.id || "");
  if (!id) return undefined;
  const rows = [
    [{ text: "ယနေ့", callback_data: `order|set_date|T|${id}` }, { text: "မနက်ဖြန်", callback_data: `order|set_date|N|${id}` }],
    [{ text: "၂ ရက်နောက်", callback_data: `order|set_date|D2|${id}` }, { text: "ရက်စွဲကိုယ်တိုင်ရေးရန်", callback_data: `order|set_date|C|${id}` }],
  ];
  if (includeBack) rows.push([{ text: "⬅️ Order သို့ပြန်ရန်", callback_data: `order|back|I|${id}` }]);
  return { inline_keyboard: rows };
}

export function buildOrderDestinationKeyboard(order, { includeBack = true } = {}) {
  const id = String(order?.id || "");
  if (!id) return undefined;
  const rows = [
    [{ text: "စက်ရုံရှေ့ လာယူ/ကားတင်ရန်", callback_data: `order|set_destination|F|${id}` }],
    [{ text: "ဂိတ်ပို့ရန်", callback_data: `order|set_destination|G|${id}` }, { text: "နေရာကိုယ်တိုင်ရေးရန်", callback_data: `order|set_destination|C|${id}` }],
  ];
  if (includeBack) rows.push([{ text: "⬅️ Order သို့ပြန်ရန်", callback_data: `order|back|I|${id}` }]);
  return { inline_keyboard: rows };
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
  const hasCustomer = Boolean(order?.customer?.id || order?.customerId || String(order?.draftCustomerName || "").trim());
  const canConfirm = !blocked && hasCustomer;
  const rows = [];
  if (canConfirm) {
    rows.push([{ text: "✅ Confirm", callback_data: `order|confirm|I|${id}` }]);
    const hasDateMissing = missingFields.some((field) => /ရက်|date/i.test(String(field)));
    const hasDestinationMissing = missingFields.some((field) => /နေရာ|ကားဂိတ်|destination/i.test(String(field)));
    const hasPhoneMissing = missingFields.some((field) => /ဖုန်း|phone/i.test(String(field)));
    if (hasDateMissing) rows.push([{ text: "📅 ရက်စွဲရွေးရန်", callback_data: `order|date_menu|I|${id}` }]);
    if (hasDestinationMissing) rows.push([{ text: "📍 နေရာရွေးရန်", callback_data: `order|destination_menu|I|${id}` }]);
    if (hasPhoneMissing) rows.push([{ text: "☎️ ဖုန်း ဖြည့်ရန်", callback_data: `order|ask_phone|I|${id}` }]);
    rows.push([{ text: "📋 အသေးစိတ်ကြည့်ရန်", callback_data: `order|menu|I|${id}` }]);
    rows.push([{ text: "❌ Cancel", callback_data: `order|cancel|I|${id}` }]);
  } else if (!blocked) {
    rows.push([{ text: "👤 ရှိပြီးသား Customer ချိတ်ရန်", callback_data: `order|customer|I|${id}` }]);
    rows.push([{ text: "➕ Order အတွက် Customer အသစ်ထားရန်", callback_data: `order|customer_create|I|${id}` }]);
    const hasDateMissing = missingFields.some((field) => /ရက်|date/i.test(String(field)));
    const hasDestinationMissing = missingFields.some((field) => /နေရာ|ကားဂိတ်|destination/i.test(String(field)));
    const hasPhoneMissing = missingFields.some((field) => /ဖုန်း|phone/i.test(String(field)));
    if (hasDateMissing) rows.push([{ text: "📅 ရက်စွဲရွေးရန်", callback_data: `order|date_menu|I|${id}` }]);
    if (hasDestinationMissing) rows.push([{ text: "📍 နေရာရွေးရန်", callback_data: `order|destination_menu|I|${id}` }]);
    if (hasPhoneMissing) rows.push([{ text: "☎️ ဖုန်း ဖြည့်ရန်", callback_data: `order|ask_phone|I|${id}` }]);
    rows.push([{ text: "📋 အသေးစိတ်ကြည့်ရန်", callback_data: `order|menu|I|${id}` }]);
    rows.push([{ text: "❌ Cancel", callback_data: `order|cancel|I|${id}` }]);
  }
  return rows.length ? { inline_keyboard: rows } : undefined;
}

export function buildOrderCustomerCandidatesKeyboard(order, candidates = []) {
  const id = String(order?.id || "");
  if (!id) return undefined;
  const rows = candidates.slice(0, 8).map((candidate, index) => [{ text: `👤 ${String(candidate.name || "Customer").slice(0, 42)}`, callback_data: `order|link|I|${id}|${index}` }]);
  rows.push([{ text: "➕ Order အတွက် Customer အသစ်ထားရန်", callback_data: `order|customer_create|I|${id}` }]);
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

export async function sendDailyReportToTelegram({ pdfBuffer, imageBuffer, salesSummaryImageBuffer, recipientChatId = null, dateLabel, caption }) {
  const { token, groupChatId } = getTelegramConfig();
  const chatId = String(recipientChatId || groupChatId || "").trim();
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and a Telegram recipient chat ID are required");
  }
  const image = await sendTelegramFile({
    token,
    chatId,
    method: "sendPhoto",
    buffer: imageBuffer,
    filename: `new-life-ledger-${dateLabel}.png`,
    mimeType: "image/png",
    caption,
  });
  const pdf = await sendTelegramFile({
    token,
    chatId,
    method: "sendDocument",
    buffer: pdfBuffer,
    filename: `New-Life-Ledger-Daily-${dateLabel}.pdf`,
    mimeType: "application/pdf",
    caption: `📄 <b>နေ့စဉ်စာရင်းချုပ် PDF</b>\n<code>${dateLabel}</code>\n<code>စာမျက်နှာ ၁ — နေ့စဉ်စာရင်းချုပ် • စာမျက်နှာ ၂ — လုပ်ဆောင်ချက်မှတ်တမ်း</code>`,
  });
  const salesSummary = salesSummaryImageBuffer ? await sendTelegramFile({
    token,
    chatId,
    method: "sendPhoto",
    buffer: salesSummaryImageBuffer,
    filename: `new-life-ledger-${dateLabel}-daily-sales-summary.png`,
    mimeType: "image/png",
    caption: `📈 <b>နေ့စဉ် လက်လီ / လက်ကား ရောင်းရငွေ</b>\n<code>${dateLabel}</code>\n<code>ယခင်နေ့ accounting date အတွက် card summary</code>`,
  }) : null;
  return { results: [{ chatId, imageMessageId: image.result?.message_id, pdfMessageId: pdf.result?.message_id, salesSummaryImageMessageId: salesSummary?.result?.message_id }] };
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
