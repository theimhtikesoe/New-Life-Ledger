function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = [process.env.TELEGRAM_PRIVATE_CHAT_ID, process.env.TELEGRAM_GROUP_CHAT_ID]
    .map((value) => value?.trim())
    .filter(Boolean);
  return { token, chatIds: [...new Set(chatIds)] };
}

async function sendTelegramFile({ token, chatId, method, buffer, filename, mimeType, caption }) {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption || "");
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

export async function sendTelegramMessage(message) {
  const { token, chatIds } = getTelegramConfig();
  const legacyChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const recipients = chatIds.length ? chatIds : legacyChatId ? [legacyChatId] : [];
  if (!token || !recipients.length) {
    console.warn("Telegram env vars are missing; skipping notification.");
    return { skipped: true };
  }

  const results = [];
  for (const chatId of recipients) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      throw new Error(`Telegram sendMessage failed for ${chatId}: ${response.status} ${body.description || "unknown error"}`);
    }
    results.push({ chatId, messageId: body.result?.message_id });
  }
  return { results };
}

export async function sendDailyReportToTelegram({ pdfBuffer, imageBuffer, dateLabel, caption }) {
  const { token, chatIds } = getTelegramConfig();
  if (!token || chatIds.length !== 2) {
    throw new Error("TELEGRAM_BOT_TOKEN, TELEGRAM_PRIVATE_CHAT_ID, and TELEGRAM_GROUP_CHAT_ID are required");
  }

  const results = [];
  for (const chatId of chatIds) {
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
      caption: `Daily report PDF — ${dateLabel}`,
    });
    results.push({ chatId, imageMessageId: image.result?.message_id, pdfMessageId: pdf.result?.message_id });
  }
  return { results };
}

export function telegramRecipientsConfigured() {
  const { token, chatIds } = getTelegramConfig();
  return Boolean(token && chatIds.length === 2);
}
