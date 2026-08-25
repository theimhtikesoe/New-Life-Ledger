import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOrderDraft: vi.fn(),
  getOrderBySourceUpdateId: vi.fn(),
  extractOrderFromText: vi.fn(),
  buildOrderDraftKeyboard: vi.fn(),
  sendTelegramTextToChat: vi.fn(),
  answerTelegramCallbackQuery: vi.fn(),
  formatOrderDraftMessage: vi.fn(),
}));

vi.mock("@/lib/order-service", () => ({ createOrderDraft: mocks.createOrderDraft, getOrderBySourceUpdateId: mocks.getOrderBySourceUpdateId }));
vi.mock("@/lib/order-ai", () => ({ extractOrderFromText: mocks.extractOrderFromText }));
vi.mock("@/lib/telegram", () => ({ buildOrderDraftKeyboard: mocks.buildOrderDraftKeyboard, sendTelegramTextToChat: mocks.sendTelegramTextToChat, answerTelegramCallbackQuery: mocks.answerTelegramCallbackQuery }));
vi.mock("@/lib/order-utils", () => ({ formatOrderDraftMessage: mocks.formatOrderDraftMessage }));

import { POST } from "@/app/api/telegram/order-webhook/route";

const chatId = "-100123456";
const order = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "DRAFT",
  requestedDate: "2026-08-26",
  destination: "ရန်ကုန်ကားဂိတ်",
  customer: { id: "22222222-2222-4222-8222-222222222222", name: "မမိုး", phone: null },
  draftCustomerName: null,
  lines: [{ bottleType: "ဘူး", capacityLabel: "1 Liter", bottlesPerCard: 100, cardCount: 2, totalBottles: 200 }],
  caps: [],
  missingFields: [],
  totals: { totalCards: 2, totalBottles: 200 },
};

function request(update, secret = "test-webhook-secret") {
  return new Request("http://localhost/api/telegram/order-webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify(update),
  });
}

function messageUpdate(text, id = 10, chat = chatId) {
  return { update_id: id, message: { message_id: id, text, chat: { id: chat, type: "supergroup" }, from: { id: 7, first_name: "Staff" } } };
}

describe("Telegram order webhook safety gates", () => {
  beforeEach(() => {
    process.env.TELEGRAM_ORDER_WEBHOOK_SECRET = "test-webhook-secret";
    process.env.TELEGRAM_ORDER_GROUP_CHAT_ID = chatId;
    process.env.NEXT_PUBLIC_APP_URL = "https://example.test";
    mocks.createOrderDraft.mockReset();
    mocks.getOrderBySourceUpdateId.mockReset().mockResolvedValue(null);
    mocks.extractOrderFromText.mockReset().mockResolvedValue({});
    mocks.buildOrderDraftKeyboard.mockReset().mockReturnValue({ inline_keyboard: [] });
    mocks.sendTelegramTextToChat.mockReset().mockResolvedValue({ messageId: 99 });
    mocks.answerTelegramCallbackQuery.mockReset().mockResolvedValue({ ok: true });
    mocks.formatOrderDraftMessage.mockReset().mockReturnValue("Draft message");
  });

  afterEach(() => {
    delete process.env.TELEGRAM_ORDER_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_ORDER_GROUP_CHAT_ID;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("rejects a missing or wrong webhook secret before reading a Telegram update", async () => {
    const response = await POST(request(messageUpdate("မှာယူမှု မမိုး"), "wrong-secret"));
    expect(response.status).toBe(401);
    expect(mocks.extractOrderFromText).not.toHaveBeenCalled();
  });

  it("ignores ordinary group messages and messages from another chat", async () => {
    const ordinary = await POST(request(messageUpdate("မင်္ဂလာပါ")));
    expect(ordinary.status).toBe(200);
    expect((await ordinary.json()).ignored).toBe("not_order_trigger");
    const wrongChat = await POST(request(messageUpdate("/order မမိုး", 11, "-100999999")));
    expect(wrongChat.status).toBe(200);
    expect((await wrongChat.json()).ignored).toBe("not_order_group");
    expect(mocks.extractOrderFromText).not.toHaveBeenCalled();
  });

  it("extracts and stores only explicitly triggered messages through mocked services", async () => {
    mocks.extractOrderFromText.mockResolvedValue({ customerName: "မမိုး" });
    mocks.createOrderDraft.mockResolvedValue({ order, duplicate: false });
    const response = await POST(request(messageUpdate("မှာယူမှု မမိုး၊ 1 Liter၊ 100 ဘူးဆံ့ 2 ကဒ်၊ ရန်ကုန်ကားဂိတ်၊ မနက်ဖြန်")));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("draft_created");
    expect(mocks.extractOrderFromText).toHaveBeenCalledWith(expect.stringContaining("မမိုး"));
    expect(mocks.createOrderDraft).toHaveBeenCalledWith(expect.objectContaining({ sourceChatId: chatId, sourceMessageId: 10, sourceUpdateId: 10 }));
    expect(mocks.sendTelegramTextToChat).toHaveBeenCalledTimes(1);
  });

  it("does not invoke AI or send a second reply for a replayed update ID", async () => {
    mocks.getOrderBySourceUpdateId.mockResolvedValue(order);
    const response = await POST(request(messageUpdate("/order မမိုး", 12)));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("duplicate");
    expect(mocks.extractOrderFromText).not.toHaveBeenCalled();
    expect(mocks.createOrderDraft).not.toHaveBeenCalled();
    expect(mocks.sendTelegramTextToChat).not.toHaveBeenCalled();
  });

  it("never changes order status from Telegram callback data", async () => {
    const update = { update_id: 13, callback_query: { id: "callback-1", data: "order|confirm|I|11111111-1111-4111-8111-111111111111", message: { chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("website_review_required");
    expect(mocks.answerTelegramCallbackQuery).toHaveBeenCalledTimes(1);
    expect(mocks.createOrderDraft).not.toHaveBeenCalled();
    expect(mocks.sendTelegramTextToChat).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("Website") }));
  });
});
