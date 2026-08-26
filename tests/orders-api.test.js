import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listOrders: vi.fn(),
  createCustomerForOrder: vi.fn(),
  linkOrderCustomer: vi.fn(),
  getOrderById: vi.fn(),
  extractOrderFromText: vi.fn(),
  refreshOrderFromAi: vi.fn(),
  archiveOrder: vi.fn(),
  restoreOrder: vi.fn(),
  restoreCancelledOrder: vi.fn(),
  deleteCancelledOrderPermanently: vi.fn(),
  updateOrderStatus: vi.fn(),
  sendFactoryNotificationForOrder: vi.fn(),
  syncTelegramOrderMessage: vi.fn(),
  buildFallbackOrderExtraction: vi.fn(),
  isFallbackExtractionUsable: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ databaseErrorResponse: vi.fn((error) => ({ error: error?.message || "Database error" })) }));
vi.mock("@/lib/audit", () => ({ getActorName: vi.fn(() => "Staff") }));
vi.mock("@/lib/order-delivery", () => ({ sendFactoryNotificationForOrder: mocks.sendFactoryNotificationForOrder }));
vi.mock("@/lib/order-channel-sync", () => ({ syncTelegramOrderMessage: mocks.syncTelegramOrderMessage }));
vi.mock("@/lib/order-ai", () => ({ extractOrderFromText: mocks.extractOrderFromText }));
vi.mock("@/lib/order-utils", () => ({ buildFallbackOrderExtraction: mocks.buildFallbackOrderExtraction, isFallbackExtractionUsable: mocks.isFallbackExtractionUsable }));
vi.mock("@/lib/order-service", () => ({
  createCustomerForOrder: mocks.createCustomerForOrder,
  getOrderById: mocks.getOrderById,
  refreshOrderFromAi: mocks.refreshOrderFromAi,
  createOrderDraft: vi.fn(),
  updateOrderDetails: vi.fn(),
  linkOrderCustomer: mocks.linkOrderCustomer,
  listOrders: mocks.listOrders,
  archiveOrder: mocks.archiveOrder,
  restoreOrder: mocks.restoreOrder,
  restoreCancelledOrder: mocks.restoreCancelledOrder,
  deleteCancelledOrderPermanently: mocks.deleteCancelledOrderPermanently,
  updateOrderStatus: mocks.updateOrderStatus,
}));

import { GET, PATCH } from "@/app/api/orders/route";

function request(body) {
  return new Request("http://localhost/api/orders", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Website Orders API", () => {
  beforeEach(() => {
    mocks.archiveOrder.mockReset();
    mocks.restoreOrder.mockReset();
    mocks.restoreCancelledOrder.mockReset();
    mocks.deleteCancelledOrderPermanently.mockReset();
    mocks.updateOrderStatus.mockReset();
    mocks.syncTelegramOrderMessage.mockReset();
    mocks.buildFallbackOrderExtraction.mockReset().mockReturnValue({});
    mocks.isFallbackExtractionUsable.mockReset().mockReturnValue(false);
  });

  it("passes archived-only list intent to the order service", async () => {
    mocks.listOrders.mockResolvedValue([]);
    const response = await GET(new Request("http://localhost/api/orders?archived=only&limit=50"));
    expect(response.status).toBe(200);
    expect(mocks.listOrders).toHaveBeenCalledWith({ status: null, view: "active", includeArchived: false, archivedOnly: true, limit: "50" });
  });

  it("links an existing Customer and updates Telegram with action buttons", async () => {
    const order = { id: "order-1", status: "DRAFT", customer: { id: "customer-1", name: "3 ဘီး (ဟိုပုံး)" }, missingFields: [], telegramDraftChatId: "-100123", telegramDraftMessageId: "88" };
    mocks.linkOrderCustomer.mockResolvedValue(order);
    mocks.syncTelegramOrderMessage.mockResolvedValue({ synced: true });
    const response = await PATCH(request({ orderId: order.id, action: "link_customer", customerId: "customer-1" }));
    expect(response.status).toBe(200);
    expect(mocks.linkOrderCustomer).toHaveBeenCalledWith({ orderId: order.id, customerId: "customer-1", actorName: "Staff" });
    expect(mocks.syncTelegramOrderMessage).toHaveBeenCalledWith(order, "🌐 Website မှ Customer ချိတ်ပြီးပါပြီ။", { includeActions: true });
    expect((await response.json()).data).toEqual(order);
  });

  it("creates a new Customer for a draft and updates Telegram without touching Ledger", async () => {
    const order = { id: "order-1", status: "DRAFT", customer: { id: "customer-1", name: "3ဘီး" }, missingFields: [], telegramDraftChatId: "-100123", telegramDraftMessageId: "88" };
    mocks.createCustomerForOrder.mockResolvedValue(order);
    mocks.syncTelegramOrderMessage.mockResolvedValue({ synced: true });
    const response = await PATCH(request({ orderId: order.id, action: "create_customer", name: "3ဘီး" }));
    expect(response.status).toBe(200);
    expect(mocks.createCustomerForOrder).toHaveBeenCalledWith({ orderId: order.id, name: "3ဘီး", phone: undefined, routeTag: undefined, actorName: "Staff" });
    expect(mocks.syncTelegramOrderMessage).toHaveBeenCalledWith(order, "🌐 Website မှ Customer အသစ်ဖန်တီးပြီး ချိတ်ထားပါပြီ။", { includeActions: true });
    expect((await response.json()).data).toEqual(order);
  });

  it("archives through a reversible action without using delete", async () => {
    const order = { id: "order-1", status: "CANCELLED", archivedAt: "2026-08-25T00:00:00.000Z" };
    mocks.archiveOrder.mockResolvedValue(order);
    const response = await PATCH(request({ orderId: order.id, action: "archive" }));
    expect(response.status).toBe(200);
    expect(mocks.archiveOrder).toHaveBeenCalledWith({ orderId: order.id, actorName: "Staff" });
    expect(mocks.restoreOrder).not.toHaveBeenCalled();
    expect((await response.json()).data).toEqual(order);
  });

  it("restores without changing the stored lifecycle status", async () => {
    const order = { id: "order-1", status: "CANCELLED", archivedAt: null };
    mocks.restoreOrder.mockResolvedValue(order);
    const response = await PATCH(request({ orderId: order.id, action: "restore" }));
    expect(response.status).toBe(200);
    expect(mocks.restoreOrder).toHaveBeenCalledWith({ orderId: order.id, actorName: "Staff" });
    expect((await response.json()).data.status).toBe("CANCELLED");
  });

  it("restores a Cancelled Order through the dedicated Trash action", async () => {
    const order = { id: "order-1", status: "DRAFT", cancelledAt: null };
    mocks.restoreCancelledOrder.mockResolvedValue(order);
    const response = await PATCH(request({ orderId: order.id, action: "trash_restore" }));
    expect(response.status).toBe(200);
    expect(mocks.restoreCancelledOrder).toHaveBeenCalledWith({ orderId: order.id, actorName: "Staff" });
    expect((await response.json()).data.status).toBe("DRAFT");
  });

  it("permanently deletes only through the explicit Trash action", async () => {
    const result = { id: "order-1", deleted: true };
    mocks.deleteCancelledOrderPermanently.mockResolvedValue(result);
    const response = await PATCH(request({ orderId: result.id, action: "trash_delete_permanently" }));
    expect(response.status).toBe(200);
    expect(mocks.deleteCancelledOrderPermanently).toHaveBeenCalledWith({ orderId: result.id, actorName: "Staff" });
    expect((await response.json()).data).toEqual(result);
    expect(mocks.updateOrderStatus).not.toHaveBeenCalled();
    expect(mocks.restoreCancelledOrder).not.toHaveBeenCalled();
  });

  it("uses complete fallback data for Website retry without calling the provider", async () => {
    const current = { id: "order-1", sourceText: "မှာယူမှု ကိုသိမ်း\\n0.3 Liter အဖြူ\\n100 ဆံ့ 20 ကဒ်\\nတောင်ပေါ်ဂိတ်\\n27.8.2026" };
    const fallback = { customerName: "ကိုသိမ်း", requestedDate: "2026-08-27", destination: "တောင်ပေါ်ဂိတ်", lines: [{ bottleType: "အဖြူ", capacityMl: 300, bottlesPerCard: 100, cardCount: 20, totalBottles: 2000 }], caps: [], missingFields: [], confidence: "low" };
    const refreshed = { id: current.id, status: "DRAFT", sourceText: current.sourceText };
    mocks.getOrderById.mockResolvedValue(current);
    mocks.buildFallbackOrderExtraction.mockReturnValue(fallback);
    mocks.isFallbackExtractionUsable.mockReturnValue(true);
    mocks.refreshOrderFromAi.mockResolvedValue(refreshed);
    mocks.syncTelegramOrderMessage.mockResolvedValue({ synced: true });
    const response = await PATCH(request({ orderId: current.id, action: "retry_ai" }));
    expect(response.status).toBe(200);
    expect(mocks.extractOrderFromText).not.toHaveBeenCalled();
    expect(mocks.refreshOrderFromAi).toHaveBeenCalledWith({ orderId: current.id, extracted: fallback, actorName: "Staff" });
  });

  it("retries AI extraction for a pending Order and syncs the result back to Telegram", async () => {
    const current = { id: "order-1", sourceText: "/order မမိုး" };
    const refreshed = { id: "order-1", status: "DRAFT", telegramDraftChatId: "-100123", telegramDraftMessageId: "88" };
    mocks.getOrderById.mockResolvedValue(current);
    mocks.extractOrderFromText.mockResolvedValue({ customerName: "မမိုး" });
    mocks.refreshOrderFromAi.mockResolvedValue(refreshed);
    mocks.syncTelegramOrderMessage.mockResolvedValue({ synced: true });
    const response = await PATCH(request({ orderId: current.id, action: "retry_ai" }));
    expect(response.status).toBe(200);
    expect(mocks.getOrderById).toHaveBeenCalledWith(current.id);
    expect(mocks.extractOrderFromText).toHaveBeenCalledWith(current.sourceText);
    expect(mocks.refreshOrderFromAi).toHaveBeenCalledWith(expect.objectContaining({ orderId: current.id, extracted: { customerName: "မမိုး" }, actorName: "Staff" }));
    expect(mocks.syncTelegramOrderMessage).toHaveBeenCalledWith(refreshed, "🔄 Website မှ AI ဖြင့် ပြန်စစ်ပြီးပါပြီ။", { includeActions: true });
    expect((await response.json()).data).toEqual(refreshed);
  });

  it("passes Website as the factory-message source for immediate Confirm", async () => {
    const statusOrder = { id: "order-1", status: "CONFIRMED" };
    const notifiedOrder = { id: "order-1", status: "FACTORY_NOTIFIED" };
    mocks.updateOrderStatus.mockResolvedValue(statusOrder);
    mocks.sendFactoryNotificationForOrder.mockResolvedValue({ sent: true, duplicate: false, messageId: 101, order: notifiedOrder });
    mocks.syncTelegramOrderMessage.mockResolvedValue({ synced: true });
    const response = await PATCH(request({ orderId: statusOrder.id, action: "confirm", mode: "IMMEDIATE" }));
    expect(response.status).toBe(200);
    expect(mocks.sendFactoryNotificationForOrder).toHaveBeenCalledWith(statusOrder.id, { actorName: "Staff", source: "WEBSITE" });
    expect((await response.json()).data).toEqual(notifiedOrder);
  });

  it("updates the shared status first and then attempts nonfatal Telegram synchronization", async () => {
    const order = { id: "order-1", status: "CANCELLED", telegramDraftChatId: "-100123", telegramDraftMessageId: "88" };
    mocks.updateOrderStatus.mockResolvedValue(order);
    mocks.syncTelegramOrderMessage.mockResolvedValue({ synced: true });
    const response = await PATCH(request({ orderId: order.id, action: "cancel" }));
    expect(response.status).toBe(200);
    expect(mocks.updateOrderStatus).toHaveBeenCalledWith({ orderId: order.id, status: "CANCELLED", actorName: "Staff" });
    expect(mocks.syncTelegramOrderMessage).toHaveBeenCalledWith(order, "❌ Website မှ Cancel လုပ်ပြီးပါပြီ။");
  });
});
