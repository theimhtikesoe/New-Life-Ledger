import { buildOrderActionKeyboard, editTelegramMessageText } from "@/lib/telegram";
import { formatOrderDraftMessage } from "@/lib/order-utils";

export async function syncTelegramOrderMessage(order, note = "", { includeActions = false } = {}) {
  const chatId = String(order?.telegramDraftChatId || "").trim();
  const messageId = Number(order?.telegramDraftMessageId);
  if (!chatId || !Number.isInteger(messageId)) return { skipped: true, reason: "missing_bot_draft_message" };

  const suffix = String(note || "").trim();
  await editTelegramMessageText({
    chatId,
    messageId,
    text: `${formatOrderDraftMessage(order, { includeActions })}${suffix ? `\n\n${suffix}` : ""}`,
    replyMarkup: includeActions ? buildOrderActionKeyboard(order, process.env.NEXT_PUBLIC_APP_URL, { allowRetry: true }) : { inline_keyboard: [] },
  });
  return { synced: true, chatId, messageId };
}

