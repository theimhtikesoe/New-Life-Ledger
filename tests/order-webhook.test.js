import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOrderDraft: vi.fn(),
  createCustomerForOrder: vi.fn(),
  getOrderCustomerCandidates: vi.fn(),
  linkOrderCustomer: vi.fn(),
  getOrderById: vi.fn(),
  getOrderBySourceUpdateId: vi.fn(),
  refreshOrderFromAi: vi.fn(),
  saveTelegramDraftMessage: vi.fn(),
  updateOrderStatus: vi.fn(),
  extractOrderFromText: vi.fn(),
  buildOrderDraftKeyboard: vi.fn(),
  buildOrderActionKeyboard: vi.fn(),
  buildOrderCustomerCandidatesKeyboard: vi.fn(),
  buildOrderMoreKeyboard: vi.fn(),
  buildOrderRetryKeyboard: vi.fn(),
  sendTelegramTextToChat: vi.fn(),
  answerTelegramCallbackQuery: vi.fn(),
  editTelegramMessageText: vi.fn(),
  getTelegramChatMember: vi.fn(),
  isTelegramOrderAdminStatus: vi.fn(),
  configuredTelegramOrderAdminIds: vi.fn(),
  formatOrderDraftMessage: vi.fn(),
  buildFallbackOrderExtraction: vi.fn(),
  isFallbackExtractionUsable: vi.fn(),
  sendFactoryNotificationForOrder: vi.fn(),
}));

vi.mock("@/lib/order-service", () => ({ createCustomerForOrder: mocks.createCustomerForOrder, createOrderDraft: mocks.createOrderDraft, getOrderById: mocks.getOrderById, getOrderCustomerCandidates: mocks.getOrderCustomerCandidates, getOrderBySourceUpdateId: mocks.getOrderBySourceUpdateId, linkOrderCustomer: mocks.linkOrderCustomer, refreshOrderFromAi: mocks.refreshOrderFromAi, saveTelegramDraftMessage: mocks.saveTelegramDraftMessage, updateOrderStatus: mocks.updateOrderStatus }));
vi.mock("@/lib/order-ai", () => ({ extractOrderFromText: mocks.extractOrderFromText }));
vi.mock("@/lib/telegram", () => ({ buildOrderDraftKeyboard: mocks.buildOrderDraftKeyboard, buildOrderActionKeyboard: mocks.buildOrderActionKeyboard, buildOrderCustomerCandidatesKeyboard: mocks.buildOrderCustomerCandidatesKeyboard, buildOrderMoreKeyboard: mocks.buildOrderMoreKeyboard, buildOrderRetryKeyboard: mocks.buildOrderRetryKeyboard, sendTelegramTextToChat: mocks.sendTelegramTextToChat, answerTelegramCallbackQuery: mocks.answerTelegramCallbackQuery, editTelegramMessageText: mocks.editTelegramMessageText, getTelegramChatMember: mocks.getTelegramChatMember, isTelegramOrderAdminStatus: mocks.isTelegramOrderAdminStatus, configuredTelegramOrderAdminIds: mocks.configuredTelegramOrderAdminIds }));
vi.mock("@/lib/order-utils", () => ({ formatOrderDraftMessage: mocks.formatOrderDraftMessage, buildFallbackOrderExtraction: mocks.buildFallbackOrderExtraction, isFallbackExtractionUsable: mocks.isFallbackExtractionUsable }));
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
    mocks.createCustomerForOrder.mockReset();
    mocks.createOrderDraft.mockReset();
    mocks.getOrderCustomerCandidates.mockReset();
    mocks.linkOrderCustomer.mockReset();
    mocks.getOrderById.mockReset();
    mocks.getOrderBySourceUpdateId.mockReset().mockResolvedValue(null);
    mocks.refreshOrderFromAi.mockReset().mockResolvedValue(order);
    mocks.saveTelegramDraftMessage.mockReset().mockResolvedValue(order);
    mocks.updateOrderStatus.mockReset();
    mocks.extractOrderFromText.mockReset().mockResolvedValue({});
    mocks.buildOrderDraftKeyboard.mockReset().mockReturnValue({ inline_keyboard: [] });
    mocks.buildOrderActionKeyboard.mockReset().mockReturnValue({ inline_keyboard: [] });
    mocks.buildOrderCustomerCandidatesKeyboard.mockReset().mockReturnValue({ inline_keyboard: [] });
    mocks.buildOrderMoreKeyboard.mockReset().mockReturnValue({ inline_keyboard: [] });
    mocks.buildOrderRetryKeyboard.mockReset().mockReturnValue({ inline_keyboard: [[{ text: "retry" }]] });
    mocks.sendTelegramTextToChat.mockReset().mockResolvedValue({ messageId: 99 });
    mocks.answerTelegramCallbackQuery.mockReset().mockResolvedValue({ ok: true });
    mocks.editTelegramMessageText.mockReset().mockResolvedValue({ ok: true });
    mocks.getTelegramChatMember.mockReset().mockResolvedValue({ status: "member" });
    mocks.isTelegramOrderAdminStatus.mockReset().mockImplementation((status) => ["administrator", "creator", "owner"].includes(status));
    mocks.configuredTelegramOrderAdminIds.mockReset().mockImplementation(() => String(process.env.TELEGRAM_ORDER_ADMIN_IDS || "").split(",").map((value) => value.trim()).filter(Boolean));
    mocks.sendFactoryNotificationForOrder.mockReset();
    mocks.formatOrderDraftMessage.mockReset().mockReturnValue("Draft message");
    mocks.buildFallbackOrderExtraction.mockReset().mockReturnValue({ customerName: "ကံလီ", customerPhone: null, requestedDate: "2026-08-26", destination: "စက်ရုံလာယူမည်", lines: [], caps: [], missingFields: [], confidence: "low", notes: "စက်ရုံလာယူမည် ၊ လာယူချိန်: မနက်ဖြန် မနက် ၇ နာရီ ခွဲ" });
    mocks.isFallbackExtractionUsable.mockReset().mockReturnValue(false);
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
    expect(mocks.sendTelegramTextToChat).toHaveBeenCalledTimes(2);
    expect(mocks.sendTelegramTextToChat).toHaveBeenNthCalledWith(1, expect.objectContaining({ chatId, replyToMessageId: 10, text: expect.stringContaining("Order စာကို စစ်နေပါသည်") }));
    expect(mocks.saveTelegramDraftMessage).toHaveBeenCalledWith({ orderId: order.id, chatId, messageId: 99 });
  });

  it("skips the provider when the deterministic extraction already has complete order fields", async () => {
    const completeFallback = {
      customerName: "3ဘီး",
      customerPhone: null,
      requestedDate: "2026-08-26",
      destination: "စက်ရုံလာယူမည်",
      lines: [{ bottleType: "နွားနို့ကြီး အဖြူ", capacityMl: 300, capacityLabel: "0.3 Liter", bottlesPerCard: 100, cardCount: 30, totalBottles: 3000, notes: null }],
      caps: [{ capType: "ရောင်စုံ", normalPcs: 3000, extraPcs: 15, requestedTotalPcs: 3015, notes: null }],
      missingFields: [],
      confidence: "low",
      notes: "စက်ရုံလာယူမည် ၊ လာယူချိန်: မနက်ဖြန် မနက် ၇ နာရီ ခွဲ",
    };
    mocks.buildFallbackOrderExtraction.mockReturnValue(completeFallback);
    mocks.isFallbackExtractionUsable.mockReturnValue(true);
    mocks.createOrderDraft.mockResolvedValue({ order, duplicate: false });
    const response = await POST(request(messageUpdate("မှာယူမှု 3ဘီး\\nနွားနို့ကြီး အဖြူ\\n0.3 Liter 100 ဆံ့ 30 ကဒ်", 16)));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ status: "draft_created", aiSkipped: true }));
    expect(mocks.extractOrderFromText).not.toHaveBeenCalled();
    expect(mocks.refreshOrderFromAi).not.toHaveBeenCalled();
    expect(mocks.sendTelegramTextToChat).toHaveBeenCalledTimes(1);
  });

  it("stores the original Telegram text as a fallback Draft when AI extraction fails", async () => {
    mocks.extractOrderFromText.mockRejectedValue(Object.assign(new Error("Order AI task မအောင်မြင်ပါ။"), { code: "MANUS_TASK" }));
    const fallbackOrder = { ...order, status: "NEEDS_CUSTOMER", sourceText: "/order ကံလီ 0.3 L 400 ဆံ့ 50 ကဒ် ပုလဲဂိတ် မနက်ဖြန်", customer: null, draftCustomerName: null };
    mocks.createOrderDraft.mockResolvedValue({ order: fallbackOrder, duplicate: false });
    const response = await POST(request(messageUpdate(fallbackOrder.sourceText)));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("draft_ai_pending");
    expect(mocks.createOrderDraft).toHaveBeenCalledWith(expect.objectContaining({
      sourceText: fallbackOrder.sourceText,
      extracted: expect.objectContaining({ customerName: expect.any(String), requestedDate: expect.any(String), confidence: "low" }),
    }));
    expect(mocks.sendTelegramTextToChat).toHaveBeenCalledWith(expect.objectContaining({ chatId, replyToMessageId: 10, text: expect.stringContaining("Order စာကို စစ်နေပါသည်") }));
    expect(mocks.sendTelegramTextToChat).toHaveBeenCalledWith(expect.objectContaining({ chatId, replyToMessageId: 10, text: expect.stringContaining("Draft အဖြစ် သိမ်းထားပါပြီ") }));
    expect(mocks.saveTelegramDraftMessage).toHaveBeenCalledWith({ orderId: fallbackOrder.id, chatId, messageId: 99 });
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

  it("lets a verified administrator retry AI from the fallback Draft button", async () => {
    mocks.getTelegramChatMember.mockResolvedValue({ status: "administrator" });
    const pending = { ...order, status: "NEEDS_CUSTOMER", sourceText: "/order မမိုး၊ 1 Liter၊ 100 ဘူးဆံ့ 2 ကဒ်၊ ရန်ကုန်ကားဂိတ်၊ မနက်ဖြန်" };
    const refreshed = { ...order, status: "DRAFT", sourceText: pending.sourceText };
    mocks.getOrderById.mockResolvedValue(pending);
    mocks.extractOrderFromText.mockResolvedValue({ customerName: "မမိုး" });
    mocks.refreshOrderFromAi.mockResolvedValue(refreshed);
    const update = { update_id: 18, callback_query: { id: "callback-retry", data: "order|retry|I|11111111-1111-4111-8111-111111111111", message: { message_id: 95, chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("ai_retried");
    expect(mocks.getOrderById).toHaveBeenCalledWith(order.id);
    expect(mocks.refreshOrderFromAi).toHaveBeenCalledWith(expect.objectContaining({ orderId: order.id, extracted: { customerName: "မမိုး" } }));
    expect(mocks.updateOrderStatus).not.toHaveBeenCalled();
    expect(mocks.sendFactoryNotificationForOrder).not.toHaveBeenCalled();
    expect(mocks.editTelegramMessageText).toHaveBeenCalledWith(expect.objectContaining({ chatId, messageId: 95 }));
  });

  it("uses complete deterministic data during retry without calling the provider", async () => {
    mocks.getTelegramChatMember.mockResolvedValue({ status: "administrator" });
    const pending = { ...order, status: "NEEDS_REVIEW", customer: null, sourceText: "မှာယူမှု ကိုသိမ်း\\n0.3 Liter အဖြူ\\n100 ဆံ့ 20 ကဒ်\\nတောင်ပေါ်ဂိတ်\\n27.8.2026" };
    const completeFallback = { customerName: "ကိုသိမ်း", requestedDate: "2026-08-27", destination: "တောင်ပေါ်ဂိတ်", lines: [{ bottleType: "အဖြူ", capacityMl: 300, capacityLabel: "0.3 Liter", bottlesPerCard: 100, cardCount: 20, totalBottles: 2000 }], caps: [], missingFields: [], confidence: "low", notes: null };
    const refreshed = { ...pending, status: "DRAFT", customer: null, missingFields: [] };
    mocks.getOrderById.mockResolvedValue(pending);
    mocks.buildFallbackOrderExtraction.mockReturnValue(completeFallback);
    mocks.isFallbackExtractionUsable.mockReturnValue(true);
    mocks.refreshOrderFromAi.mockResolvedValue(refreshed);
    const update = { update_id: 203, callback_query: { id: "callback-retry-deterministic", data: `order|retry|I|${order.id}`, message: { message_id: 197, chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("ai_retried");
    expect(mocks.extractOrderFromText).not.toHaveBeenCalled();
    expect(mocks.refreshOrderFromAi).toHaveBeenCalledWith({ orderId: order.id, extracted: completeFallback, actorName: "Staff" });
  });

  it("keeps a visible retry action when AI retry fails", async () => {
    mocks.getTelegramChatMember.mockResolvedValue({ status: "administrator" });
    const pending = { ...order, status: "NEEDS_REVIEW", customer: null, sourceText: "/order မမိုး" };
    mocks.getOrderById.mockResolvedValue(pending);
    mocks.extractOrderFromText.mockRejectedValue(Object.assign(new Error("Order AI task မအောင်မြင်ပါ။"), { code: "MANUS_TASK" }));
    const update = { update_id: 202, callback_query: { id: "callback-retry-failed", data: `order|retry|I|${order.id}`, message: { message_id: 196, chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("ai_retry_failed");
    expect(mocks.answerTelegramCallbackQuery).toHaveBeenCalledWith(expect.objectContaining({ callbackQueryId: "callback-retry-failed", text: "AI ဖြင့် ပြန်စစ်နေပါသည်။ ခဏစောင့်ပေးပါ။" }));
    expect(mocks.editTelegramMessageText).toHaveBeenCalledTimes(2);
    expect(mocks.editTelegramMessageText.mock.calls[0][0].text).toContain("AI ဖြင့် ပြန်စစ်နေပါသည်");
    expect(mocks.editTelegramMessageText.mock.calls[1][0].text).toContain("AI ပြန်စစ်ရာတွင် အဆင်မပြေသေးပါ");
    expect(mocks.buildOrderRetryKeyboard).toHaveBeenCalledWith(pending, process.env.NEXT_PUBLIC_APP_URL);
    expect(mocks.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("lets a verified administrator open More actions without queuing the batch", async () => {
    mocks.getTelegramChatMember.mockResolvedValue({ status: "administrator" });
    mocks.getOrderById.mockResolvedValue(order);
    const update = { update_id: 19, callback_query: { id: "callback-menu", data: "order|menu|I|11111111-1111-4111-8111-111111111111", message: { message_id: 96, chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("menu_opened");
    expect(mocks.buildOrderMoreKeyboard).toHaveBeenCalledWith(order);
    expect(mocks.updateOrderStatus).not.toHaveBeenCalled();
    expect(mocks.editTelegramMessageText).toHaveBeenCalledWith(expect.objectContaining({ chatId, messageId: 96, replyMarkup: { inline_keyboard: [] } }));
  });

  it("shows existing Customer candidate buttons when the Telegram selection callback is pressed", async () => {
    mocks.getTelegramChatMember.mockResolvedValue({ status: "administrator" });
    const pending = { ...order, status: "NEEDS_CUSTOMER", customer: null, customerId: null, draftCustomerName: "3ဘီး", missingFields: ["Customer"] };
    const candidate = { id: "33333333-3333-4333-8333-333333333333", name: "3 ဘီး (ဟိုပုံး)" };
    mocks.getOrderCustomerCandidates.mockResolvedValue({ order: pending, candidates: [candidate] });
    mocks.formatOrderDraftMessage.mockReturnValue("draft message");
    const update = { update_id: 201, callback_query: { id: "callback-customer", data: `order|customer|I|${order.id}`, message: { message_id: 197, chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("customer_candidates");
    expect(body.candidateCount).toBe(1);
    expect(mocks.getOrderCustomerCandidates).toHaveBeenCalledWith({ orderId: order.id });
    expect(mocks.buildOrderCustomerCandidatesKeyboard).toHaveBeenCalledWith(pending, [candidate]);
    expect(mocks.editTelegramMessageText).toHaveBeenCalledWith(expect.objectContaining({ chatId, messageId: 197, parseMode: "Markdown" }));
    expect(mocks.linkOrderCustomer).not.toHaveBeenCalled();
    expect(mocks.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("retries Customer candidate message as plain text when Markdown editing fails", async () => {
    mocks.getTelegramChatMember.mockResolvedValue({ status: "administrator" });
    const pending = { ...order, status: "NEEDS_CUSTOMER", customer: null, customerId: null, draftCustomerName: "Customer_စမ်း", missingFields: ["Customer"] };
    const candidate = { id: "33333333-3333-4333-8333-333333333333", name: "Customer_စမ်း" };
    mocks.getOrderCustomerCandidates.mockResolvedValue({ order: pending, candidates: [candidate] });
    mocks.formatOrderDraftMessage.mockReturnValue("draft ``` message");
    mocks.editTelegramMessageText.mockRejectedValueOnce(new Error("can't parse Markdown")).mockResolvedValueOnce({ ok: true });
    const update = { update_id: 202, callback_query: { id: "callback-customer-fallback", data: `order|customer|I|${order.id}`, message: { message_id: 198, chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("customer_candidates");
    expect(mocks.editTelegramMessageText).toHaveBeenCalledTimes(2);
    expect(mocks.editTelegramMessageText.mock.calls[1][0]).not.toHaveProperty("parseMode");
    expect(mocks.editTelegramMessageText.mock.calls[1][0].text).not.toContain("```");
  });

  it("lets a verified administrator choose and link an existing Customer", async () => {
    mocks.getTelegramChatMember.mockResolvedValue({ status: "administrator" });
    const pending = { ...order, status: "NEEDS_CUSTOMER", customer: null, customerId: null, draftCustomerName: "3ဘီး", missingFields: ["Customer"] };
    const linked = { ...order, status: "DRAFT", customer: { id: "33333333-3333-4333-8333-333333333333", name: "3 ဘီး (ဟိုပုံး)" }, customerId: "33333333-3333-4333-8333-333333333333" };
    mocks.getOrderCustomerCandidates.mockResolvedValue({ order: pending, candidates: [{ id: linked.customer.id, name: linked.customer.name }] });
    mocks.linkOrderCustomer.mockResolvedValue(linked);
    const update = { update_id: 20, callback_query: { id: "callback-link", data: `order|link|I|${order.id}|${linked.customer.id}`, message: { message_id: 97, chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("customer_linked");
    expect(mocks.linkOrderCustomer).toHaveBeenCalledWith({ orderId: order.id, customerId: linked.customer.id, actorName: "Staff" });
    expect(mocks.buildOrderActionKeyboard).toHaveBeenCalledWith(linked, process.env.NEXT_PUBLIC_APP_URL, { allowRetry: true });
    expect(mocks.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("lets a verified administrator create a new Customer from the Telegram Draft", async () => {
    mocks.getTelegramChatMember.mockResolvedValue({ status: "administrator" });
    const pending = { ...order, status: "NEEDS_CUSTOMER", customer: null, customerId: null, draftCustomerName: "Customer အသစ်", draftCustomerPhone: "0912345678" };
    const created = { ...order, status: "DRAFT", customer: { id: "44444444-4444-4444-8444-444444444444", name: "Customer အသစ်" }, customerId: "44444444-4444-4444-8444-444444444444" };
    mocks.getOrderById.mockResolvedValue(pending);
    mocks.createCustomerForOrder.mockResolvedValue(created);
    const update = { update_id: 21, callback_query: { id: "callback-create-customer", data: `order|customer_create|I|${order.id}`, message: { message_id: 98, chat: { id: chatId } }, from: { id: 7 } } };
    const response = await POST(request(update));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("customer_created");
    expect(mocks.createCustomerForOrder).toHaveBeenCalledWith({ orderId: order.id, name: "Customer အသစ်", phone: "0912345678", actorName: "Staff" });
    expect(mocks.buildOrderActionKeyboard).toHaveBeenCalledWith(created, process.env.NEXT_PUBLIC_APP_URL, { allowRetry: true });
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
    expect(mocks.sendFactoryNotificationForOrder).toHaveBeenCalledWith(order.id, { actorName: "Staff", source: "TELEGRAM" });
    expect(mocks.editTelegramMessageText).toHaveBeenCalledWith(expect.objectContaining({ chatId, messageId: 91, replyMarkup: { inline_keyboard: [] } }));
  });
});
