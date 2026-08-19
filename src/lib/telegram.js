function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID?.trim();
  return { token, groupChatId };
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
  const { token, groupChatId } = getTelegramConfig();
  if (!token || !groupChatId) {
    console.warn("Telegram group env vars are missing; skipping notification.");
    return { skipped: true };
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: groupChatId, text: message, parse_mode: "HTML" }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    throw new Error(`Telegram sendMessage failed for ${groupChatId}: ${response.status} ${body.description || "unknown error"}`);
  }
  return { results: [{ chatId: groupChatId, messageId: body.result?.message_id }] };
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
    caption: `Activity History — ${dateLabel}`,
  }) : null;
  const pdf = await sendTelegramFile({
    token,
    chatId: groupChatId,
    method: "sendDocument",
    buffer: pdfBuffer,
    filename: `New-Life-Ledger-Daily-${dateLabel}.pdf`,
    mimeType: "application/pdf",
    caption: `Daily report PDF — ${dateLabel}`,
  });
  return { results: [{ chatId: groupChatId, imageMessageId: image.result?.message_id, activityImageMessageId: activity?.result?.message_id, pdfMessageId: pdf.result?.message_id }] };
}

export function telegramRecipientsConfigured() {
  const { token, groupChatId } = getTelegramConfig();
  return Boolean(token && groupChatId);
}
