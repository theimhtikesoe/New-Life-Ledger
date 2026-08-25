import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTelegramOrderConfig: vi.fn(),
  sendTelegramTextToChat: vi.fn(),
  pinTelegramMessage: vi.fn(),
}));

vi.mock("@/lib/telegram", () => mocks);

import { POST } from "@/app/api/admin/telegram-order-guide/route";

describe("Telegram Order guide endpoint", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://newlifeledger.vercel.app/";
    mocks.getTelegramOrderConfig.mockReset().mockReturnValue({ token: "configured", orderChatId: "-100123", factoryChatId: "-100456" });
    mocks.sendTelegramTextToChat.mockReset().mockResolvedValue({ messageId: 987 });
    mocks.pinTelegramMessage.mockReset().mockResolvedValue({ ok: true });
  });

  it("sends the safe trigger guide with website buttons and pins it in the Order group", async () => {
    const response = await POST();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, messageId: 987, pinned: true });
    expect(mocks.sendTelegramTextToChat).toHaveBeenCalledWith(expect.objectContaining({ chatId: "-100123", text: expect.stringContaining("မှာယူမှု"), replyMarkup: { inline_keyboard: [[{ text: "📝 Order ရေးနည်း", url: "https://newlifeledger.vercel.app/orders#telegram-order-guide" }], [{ text: "🌐 Website Orders ကြည့်ရန်", url: "https://newlifeledger.vercel.app/orders" }]] } }));
    expect(mocks.pinTelegramMessage).toHaveBeenCalledWith({ chatId: "-100123", messageId: 987, disableNotification: false });
  });

  it("does not call Telegram when the Order group is not configured", async () => {
    mocks.getTelegramOrderConfig.mockReturnValue({ token: "configured", orderChatId: "", factoryChatId: "-100456" });
    const response = await POST();
    expect(response.status).toBe(409);
    expect(mocks.sendTelegramTextToChat).not.toHaveBeenCalled();
    expect(mocks.pinTelegramMessage).not.toHaveBeenCalled();
  });
});
