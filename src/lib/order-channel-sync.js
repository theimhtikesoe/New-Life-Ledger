import { buildOrderActionKeyboard, editTelegramMessageText } from "@/lib/telegram";
import { formatOrderDraftMessage } from "@/lib/order-utils";

export async function syncTelegramOrderMessage(order, note = "", { includeActions = false } = {}) {
  const chatId = String(order?.telegramDraftChatId || "").trim();
  const messageId = Number(order?.telegramDraftMessageId);
  if (!chatId || !Number.isInteger(messageId)) return { skipped: true, reason: "missing_bot_draft_message" };

  const suffix = String(note || "").trim();
  const text = `${formatOrderDraftMessage(order, { includeActions })}${suffix ? `\n\n${suffix}` : ""}`;
  const replyMarkup = includeActions ? buildOrderActionKeyboard(order, process.env.NEXT_PUBLIC_APP_URL, { allowRetry: true }) : { inline_keyboard: [] };
  try {
    await editTelegramMessageText({ chatId, messageId, text, parseMode: "Markdown", replyMarkup });
  } catch (error) {
    // Customer names/order text can contain Telegram Markdown characters such as `_`.
    // Keep cross-channel status sync working by retrying the same edit as plain text.
    console.warn("Telegram Order Markdown sync failed; retrying plain text", error);
    await editTelegramMessageText({ chatId, messageId, text: text.replace(/```/g, ""), replyMarkup });
  }
  return { synced: true, chatId, messageId };
}

