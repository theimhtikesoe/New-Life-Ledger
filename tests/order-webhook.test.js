import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOrderDraft: vi.fn(),
  getOrderBySourceUpdateId: vi.fn(),
  updateOrderStatus: vi.fn(),
  extractOrderFromText: vi.fn(),
  buildOrderDraftKeyboard: vi.fn(),
  sendTelegramTextToChat: vi.fn(),
  answerTelegramCallbackQuery: vi.fn(),
  editTelegramMessageText: vi.fn(),
  getTelegramChatMember: vi.fn(),
  isTelegramOrderAdminStatus: vi.fn(),
  configuredTelegramOrderAdminIds: vi.fn(),
  formatOrderDraftMessage: vi.fn(),
  sendFactoryNotificationForOrder: vi.fn(),
}));

vi.mock("@/lib/order-service", () => ({ createOrderDraft: mocks.createOrderDraft, getOrderBySourceUpdateId: mocks.getOrderBySourceUpdateId, updateOrderStatus: mocks.updateOrderStatus }));
vi.mock("@/lib/order-ai", () => ({ extractOrderFromText: mocks.extractOrderFromText }));
vi.mock("@/lib/telegram", () => ({ buildOrderDraftKeyboard: mocks.buildOrderDraftKeyboard, sendTelegramTextToChat: mocks.sendTelegramTextToChat, answerTelegramCallbackQuery: mocks.answerTelegramCallbackQuery, editTelegramMessageText: mocks.editTelegramMessageText, getTelegramChatMember: mocks.getTelegramChatMember, isTelegramOrderAdminStatus: mocks.isTelegramOrderAdminStatus, configuredTelegramOrderAdminIds: mocks.configuredTelegramOrderAdminIds }));
vi.mock("@/lib/order-utils", () => ({ formatOrderDraftMessage: mocks.formatOrderDraftMessage }));
vi.mock("@/lib/order-delivery", () => ({ sendFactoryNotificationForOrder: mocks.sendFactoryNotificationForOrder }));

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
    delete process.env.TELEGRAM_ORDER_ADMIN_IDS;
    mocks.createOrderDraft.mockReset();
    mocks.getOrderBySourceUpdateId.mockReset().mockResolvedValue(null);
    mocks.updateOrderStatus.mockReset();
    mocks.extractOrderFromText.mockReset().mockResolvedValue({});
    mocks.buildOrderDraftKeyboard.mockReset().mockReturnValue({ inline_keyboard: [] });
    mocks.sendTelegramTextToChat.mockReset().mockResolvedValue({ messageId: 99 });
    mocks.answerTelegramCallbackQuery.mockReset().mockResolvedValue({ ok: true });
    mocks.editTelegramMessageText.mockReset().mockResolvedValue({ ok: true });
    mocks.getTelegramChatMember.mockReset().mockResolvedValue({ status: "member" });
    mocks.isTelegramOrderAdminStatus.mockReset().mockImplementation((status) => ["administrator", "creator", "owner"].includes(status));
    mocks.configuredTelegramOrderAdminIds.mockReset().mockImplementation(() => String(process.env.TELEGRAM_ORDER_ADMIN_IDS || "").split(",").map((value) => value.trim()).filter(Boolean));
    mocks.sendFactoryNotificationForOrder.mockReset();
    mocks.formatOrderDraftMessage.mockReset().mockReturnValue("Draft message");
  });

  afterEach(() => {
    delete process.env.TELEGRAM_ORDER_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_ORDER_GROUP_CHAT_ID;
    delete process.env.TELEGRAM_ORDER_ADMIN_IDS;
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

  it("does not create an order when AI extraction fails and sends one safe reply", async () => {
    mocks.extractOrderFromText.mockRejectedValue(Object.assign(new Error("Order AI task မအောင်မြင်ပါ။"), { code: "MANUS_TASK" }));
    const response = await POST(request(messageUpdate("/order ကံလီ 0.3 L 400 ဆံ့ 50 ကဒ် ပုလဲဂိတ် မနက်ဖြန်")));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("ai_failed");
    expect(mocks.createOrderDraft).not.toHaveBeenCalled();
    expect(mocks.sendTelegramTextToChat).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegramTextToChat).toHaveBeenCalledWith(expect.objectContaining({ chatId, replyToMessageId: 10, text: expect.stringContaining("Order AI task") }));
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

  it("rejects a callback from a non-admin without changing order status", async () => {
    const update = { update_id: 13, callback_query: { id: "callback-1", data: "order|confirm|I|11111111-1111-4111-8111-111111111111", message: { message_id: 90, chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).ignored).toBe("not_order_admin");
    expect(mocks.getTelegramChatMember).toHaveBeenCalledWith({ chatId, userId: 7 });
    expect(mocks.updateOrderStatus).not.toHaveBeenCalled();
    expect(mocks.editTelegramMessageText).not.toHaveBeenCalled();
    expect(mocks.sendFactoryNotificationForOrder).not.toHaveBeenCalled();
    expect(mocks.answerTelegramCallbackQuery).toHaveBeenCalledWith(expect.objectContaining({ showAlert: true }));
  });

  it("can narrow permission to a selected admin allowlist before calling Telegram member lookup", async () => {
    process.env.TELEGRAM_ORDER_ADMIN_IDS = "8,9";
    const update = { update_id: 15, callback_query: { id: "callback-allowlist", data: "order|confirm|I|11111111-1111-4111-8111-111111111111", message: { message_id: 92, chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).ignored).toBe("not_order_admin");
    expect(mocks.getTelegramChatMember).not.toHaveBeenCalled();
    expect(mocks.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("lets a verified administrator cancel directly and edits the original draft message", async () => {
    mocks.getTelegramChatMember.mockResolvedValue({ status: "creator" });
    mocks.updateOrderStatus.mockResolvedValue({ ...order, status: "CANCELLED" });
    const update = { update_id: 16, callback_query: { id: "callback-cancel", data: "order|cancel|I|11111111-1111-4111-8111-111111111111", message: { message_id: 93, chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("cancelled");
    expect(mocks.updateOrderStatus).toHaveBeenCalledWith(expect.objectContaining({ orderId: order.id, status: "CANCELLED", actorName: "Staff" }));
    expect(mocks.editTelegramMessageText).toHaveBeenCalledWith(expect.objectContaining({ chatId, messageId: 93, replyMarkup: { inline_keyboard: [] } }));
    expect(mocks.sendFactoryNotificationForOrder).not.toHaveBeenCalled();
  });

  it("lets a verified administrator queue the 08:10 batch without sending to the factory immediately", async () => {
    mocks.getTelegramChatMember.mockResolvedValue({ status: "administrator" });
    mocks.updateOrderStatus.mockResolvedValue({ ...order, status: "BATCH_QUEUED" });
    const update = { update_id: 17, callback_query: { id: "callback-batch", data: "order|confirm|B|11111111-1111-4111-8111-111111111111", message: { message_id: 94, chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("batch_queued");
    expect(mocks.updateOrderStatus).toHaveBeenCalledWith(expect.objectContaining({ orderId: order.id, status: "BATCH_QUEUED", mode: "MORNING_BATCH" }));
    expect(mocks.sendFactoryNotificationForOrder).not.toHaveBeenCalled();
  });

  it("lets a verified group administrator confirm immediately and calls the factory delivery service", async () => {
    mocks.getTelegramChatMember.mockResolvedValue({ status: "administrator" });
    const confirmed = { ...order, status: "CONFIRMED" };
    const notified = { ...order, status: "FACTORY_NOTIFIED" };
    mocks.updateOrderStatus.mockResolvedValue(confirmed);
    mocks.sendFactoryNotificationForOrder.mockResolvedValue({ sent: true, duplicate: false, messageId: 101, order: notified });
    const update = { update_id: 14, callback_query: { id: "callback-2", data: "order|confirm|I|11111111-1111-4111-8111-111111111111", message: { message_id: 91, chat: { id: chatId } }, from: { id: 7, username: "admin_user" } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("confirmed");
    expect(mocks.updateOrderStatus).toHaveBeenCalledWith(expect.objectContaining({ orderId: order.id, status: "CONFIRMED", mode: "IMMEDIATE", actorName: "Staff" }));
    expect(mocks.sendFactoryNotificationForOrder).toHaveBeenCalledWith(order.id, { actorName: "Staff" });
    expect(mocks.editTelegramMessageText).toHaveBeenCalledWith(expect.objectContaining({ chatId, messageId: 91, replyMarkup: { inline_keyboard: [] } }));
  });
});
