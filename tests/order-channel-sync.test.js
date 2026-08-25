import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  editTelegramMessageText: vi.fn(),
  buildOrderActionKeyboard: vi.fn(),
  formatOrderDraftMessage: vi.fn(),
}));

vi.mock("@/lib/telegram", () => ({ editTelegramMessageText: mocks.editTelegramMessageText, buildOrderActionKeyboard: mocks.buildOrderActionKeyboard }));
vi.mock("@/lib/order-utils", () => ({ formatOrderDraftMessage: mocks.formatOrderDraftMessage }));

import { syncTelegramOrderMessage } from "@/lib/order-channel-sync";

describe("Telegram order message synchronization", () => {
  it("skips old orders that have no persisted bot reply metadata", async () => {
    const result = await syncTelegramOrderMessage({ sourceChatId: "-100123", sourceMessageId: "44", status: "CANCELLED" }, "cancelled");
    expect(result).toEqual({ skipped: true, reason: "missing_bot_draft_message" });
    expect(mocks.editTelegramMessageText).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    mocks.editTelegramMessageText.mockReset();
    mocks.buildOrderActionKeyboard.mockReset().mockReturnValue({ inline_keyboard: [[{ text: "retry" }]] });
    mocks.formatOrderDraftMessage.mockReset();
  });

  it("edits the persisted bot reply and removes the action keyboard", async () => {
    mocks.formatOrderDraftMessage.mockReturnValue("🟡 Order — Cancel ပြီး");
    mocks.editTelegramMessageText.mockResolvedValue({ ok: true });
    const order = { id: "order-1", status: "CANCELLED", telegramDraftChatId: "-100123", telegramDraftMessageId: "88" };
    const result = await syncTelegramOrderMessage(order, "❌ Website မှ Cancel လုပ်ပြီးပါပြီ။");
    expect(result).toEqual({ synced: true, chatId: "-100123", messageId: 88 });
    expect(mocks.formatOrderDraftMessage).toHaveBeenCalledWith(order, { includeActions: false });
    expect(mocks.editTelegramMessageText).toHaveBeenCalledWith({
      chatId: "-100123",
      messageId: 88,
      text: "🟡 Order — Cancel ပြီး\n\n❌ Website မှ Cancel လုပ်ပြီးပါပြီ။",
      replyMarkup: { inline_keyboard: [] },
    });
  });

  it("restores action buttons when a website AI retry succeeds", async () => {
    mocks.formatOrderDraftMessage.mockReturnValue("🟡 Order — Draft");
    const order = { id: "order-1", status: "DRAFT", telegramDraftChatId: "-100123", telegramDraftMessageId: "88" };
    await syncTelegramOrderMessage(order, "🔄 retried", { includeActions: true });
    expect(mocks.buildOrderActionKeyboard).toHaveBeenCalledWith(order, undefined, { allowRetry: true });
    expect(mocks.editTelegramMessageText).toHaveBeenCalledWith(expect.objectContaining({ replyMarkup: { inline_keyboard: [[{ text: "retry" }]] } }));
  });
});
