import { editTelegramMessageText } from "@/lib/telegram";
import { formatOrderDraftMessage } from "@/lib/order-utils";

export async function syncTelegramOrderMessage(order, note = "") {
  const chatId = String(order?.telegramDraftChatId || "").trim();
  const messageId = Number(order?.telegramDraftMessageId);
  if (!chatId || !Number.isInteger(messageId)) return { skipped: true, reason: "missing_bot_draft_message" };

  const suffix = String(note || "").trim();
  await editTelegramMessageText({
    chatId,
    messageId,
    text: `${formatOrderDraftMessage(order, { includeActions: false })}${suffix ? `\n\n${suffix}` : ""}`,
    replyMarkup: { inline_keyboard: [] },
  });
  return { synced: true, chatId, messageId };
}

