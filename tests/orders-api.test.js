import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listOrders: vi.fn(),
  getOrderById: vi.fn(),
  extractOrderFromText: vi.fn(),
  refreshOrderFromAi: vi.fn(),
  archiveOrder: vi.fn(),
  restoreOrder: vi.fn(),
  restoreCancelledOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
  sendFactoryNotificationForOrder: vi.fn(),
  syncTelegramOrderMessage: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ databaseErrorResponse: vi.fn((error) => ({ error: error?.message || "Database error" })) }));
vi.mock("@/lib/audit", () => ({ getActorName: vi.fn(() => "Staff") }));
vi.mock("@/lib/order-delivery", () => ({ sendFactoryNotificationForOrder: mocks.sendFactoryNotificationForOrder }));
vi.mock("@/lib/order-channel-sync", () => ({ syncTelegramOrderMessage: mocks.syncTelegramOrderMessage }));
vi.mock("@/lib/order-ai", () => ({ extractOrderFromText: mocks.extractOrderFromText }));
vi.mock("@/lib/order-service", () => ({
  createCustomerForOrder: vi.fn(),
  getOrderById: mocks.getOrderById,
  refreshOrderFromAi: mocks.refreshOrderFromAi,
  createOrderDraft: vi.fn(),
  updateOrderDetails: vi.fn(),
  linkOrderCustomer: vi.fn(),
  listOrders: mocks.listOrders,
  archiveOrder: mocks.archiveOrder,
  restoreOrder: mocks.restoreOrder,
  restoreCancelledOrder: mocks.restoreCancelledOrder,
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
  it("passes archived-only list intent to the order service", async () => {
    mocks.listOrders.mockResolvedValue([]);
    const response = await GET(new Request("http://localhost/api/orders?archived=only&limit=50"));
    expect(response.status).toBe(200);
    expect(mocks.listOrders).toHaveBeenCalledWith({ status: null, view: "active", includeArchived: false, archivedOnly: true, limit: "50" });
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
