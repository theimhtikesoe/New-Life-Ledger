import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  orderFindMany: vi.fn(),
  orderFindUnique: vi.fn(),
  orderUpdate: vi.fn(),
  orderUpdateMany: vi.fn(),
  orderDelete: vi.fn(),
  auditFindMany: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ ensureDatabase: mocks.ensureDatabase }));
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findMany: mocks.orderFindMany, findUnique: mocks.orderFindUnique, update: mocks.orderUpdate, updateMany: mocks.orderUpdateMany, delete: mocks.orderDelete }, auditLog: { findMany: mocks.auditFindMany }, $transaction: vi.fn(async (callback) => callback({ order: { updateMany: mocks.orderUpdateMany, delete: mocks.orderDelete }, auditLog: { create: vi.fn() } })) } }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/order-utils", () => ({
  calculateCapWarnings: vi.fn(() => []),
  calculateMissingStatus: vi.fn(),
  calculateOrderTotals: vi.fn(() => ({ totalCards: 0, totalBottles: 0, totalNormalCaps: 0, totalExtraCaps: 0 })),
  normalizeExtractedOrder: vi.fn(),
  normalizeDateInput: vi.fn(),
}));

import { archiveExpiredOrders, archiveOrder, deleteCancelledOrderPermanently, deleteHistoryTrashOrderPermanently, listOrders, moveHistoryOrderToTrash, purgeExpiredCancelledOrders, purgeExpiredHistoryTrash, restoreCancelledOrder, restoreHistoryTrashOrder, restoreOrder } from "@/lib/order-service";

const activeOrder = { id: "order-1", status: "NEEDS_REVIEW", archivedAt: null, lines: [], caps: [], deliveries: [], customer: null };

function archivedOrder(status = "CANCELLED") {
  return { id: "order-1", status, archivedAt: new Date("2026-08-25T12:00:00.000Z"), archivedBy: "Staff", lines: [], caps: [], deliveries: [], customer: null };
}

describe("Order archive service", () => {
  beforeEach(() => {
    mocks.ensureDatabase.mockReset().mockResolvedValue(undefined);
    mocks.orderFindMany.mockReset().mockResolvedValue([]);
    mocks.orderFindUnique.mockReset();
    mocks.orderUpdate.mockReset();
    mocks.orderUpdateMany.mockReset().mockResolvedValue({ count: 0 });
    mocks.orderDelete.mockReset().mockResolvedValue({});
    mocks.auditFindMany.mockReset().mockResolvedValue([]);
    mocks.writeAuditLog.mockReset().mockResolvedValue(undefined);
  });

  it("lists only active orders by default and archived orders when requested", async () => {
    await listOrders();
    expect(mocks.orderFindMany.mock.calls[0][0].where).toEqual({ archivedAt: null, historyTrashedAt: null, status: { not: "CANCELLED" } });
    await listOrders({ archivedOnly: true });
    expect(mocks.orderFindMany.mock.calls[1][0].where).toEqual({ archivedAt: { not: null }, historyTrashedAt: null, status: { not: "CANCELLED" } });
  });

  it("automatically archives non-cancelled orders whose requested date is before the Myanmar today date", async () => {
    const now = new Date("2026-08-26T03:00:00.000Z");
    mocks.orderFindMany.mockResolvedValue([
      { id: "expired", status: "FACTORY_NOTIFIED", requestedDate: "2026-08-25", customer: { name: "စမ်းသပ် Customer" }, draftCustomerName: null },
    ]);
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
    const result = await archiveExpiredOrders({ now, actorName: "System" });
    expect(result).toEqual({ archivedCount: 1, skippedCount: 0, cutoffDate: "2026-08-26" });
    expect(mocks.orderFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ archivedAt: null, historyTrashedAt: null, status: { not: "CANCELLED" }, requestedDate: { not: null, lt: "2026-08-26" } }) }));
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "expired" }), data: { archivedAt: now, archivedBy: "System" } }));
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ORDER_AUTO_ARCHIVE", entityId: "expired" }));
  });

  it("moves a History Order to reversible History Trash without touching Customer or Ledger", async () => {
    const current = { ...archivedOrder("FACTORY_NOTIFIED"), historyTrashedAt: null, historyTrashedBy: null };
    const trashed = { ...current, historyTrashedAt: new Date("2026-08-26T03:00:00.000Z"), historyTrashedBy: "Staff" };
    mocks.orderFindUnique.mockResolvedValue(current);
    mocks.orderUpdate.mockResolvedValue(trashed);
    const result = await moveHistoryOrderToTrash({ orderId: current.id, actorName: "Staff", now: new Date("2026-08-26T03:00:00.000Z") });
    expect(result.historyTrashedBy).toBe("Staff");
    expect(mocks.orderUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { historyTrashedAt: new Date("2026-08-26T03:00:00.000Z"), historyTrashedBy: "Staff" } }));
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ORDER_HISTORY_TRASH" }));
  });

  it("restores and permanently deletes only History Trash orders", async () => {
    const current = { ...archivedOrder("FACTORY_NOTIFIED"), historyTrashedAt: new Date("2026-08-25T00:00:00.000Z"), historyTrashedBy: "Staff" };
    const restored = { ...current, historyTrashedAt: null, historyTrashedBy: null };
    mocks.orderFindUnique.mockResolvedValueOnce(current).mockResolvedValueOnce(current);
    mocks.orderUpdate.mockResolvedValue(restored);
    expect((await restoreHistoryTrashOrder({ orderId: current.id })).historyTrashedAt).toBeNull();
    expect(mocks.orderUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { historyTrashedAt: null, historyTrashedBy: null } }));
    const deleted = await deleteHistoryTrashOrderPermanently({ orderId: current.id });
    expect(deleted).toEqual({ id: current.id, deleted: true });
    expect(mocks.orderDelete).toHaveBeenCalledWith({ where: { id: current.id } });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ORDER_HISTORY_TRASH_DELETE" }));
  });

  it("auto-clears History Trash only after the existing 15-day retention window", async () => {
    const now = new Date("2026-08-26T00:00:00.000Z");
    mocks.orderFindMany.mockResolvedValue([{ id: "history-expired", historyTrashedAt: new Date("2026-08-01T00:00:00.000Z"), customer: { name: "စမ်းသပ် Customer" }, draftCustomerName: null }]);
    const result = await purgeExpiredHistoryTrash({ now });
    expect(result).toEqual({ deletedCount: 1 });
    expect(mocks.orderDelete).toHaveBeenCalledWith({ where: { id: "history-expired" } });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ORDER_HISTORY_TRASH_AUTO_CLEAR" }));
  });

  it("rejects archiving active or queued orders without writing anything", async () => {
    mocks.orderFindUnique.mockResolvedValue(activeOrder);
    await expect(archiveOrder({ orderId: activeOrder.id })).rejects.toThrow("အရင် Cancel လုပ်ပြီးမှ Archive");
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("restores archive metadata while preserving the original lifecycle status", async () => {
    const current = archivedOrder("FACTORY_NOTIFIED");
    const restored = { ...current, archivedAt: null, archivedBy: null };
    mocks.orderFindUnique.mockResolvedValue(current);
    mocks.orderUpdate.mockResolvedValue(restored);
    const result = await restoreOrder({ orderId: current.id, actorName: "Staff" });
    expect(result.status).toBe("FACTORY_NOTIFIED");
    expect(mocks.orderUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { archivedAt: null, archivedBy: null } }));
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ORDER_RESTORE", metadata: { restoredStatus: "FACTORY_NOTIFIED" } }));
  });

  it("restores a recent Cancelled Order to Draft and clears cancellation metadata", async () => {
    const current = { ...activeOrder, status: "CANCELLED", cancelledAt: new Date("2026-08-20T00:00:00.000Z"), cancelledBy: "Staff" };
    const restored = { ...current, status: "DRAFT", cancelledAt: null, cancelledBy: null, lines: [], caps: [], deliveries: [], customer: null };
    mocks.orderFindUnique.mockResolvedValue(current);
    mocks.orderUpdate.mockResolvedValue(restored);
    const result = await restoreCancelledOrder({ orderId: current.id, now: new Date("2026-08-25T00:00:00.000Z") });
    expect(result.status).toBe("DRAFT");
    expect(mocks.orderUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DRAFT", cancelledAt: null, cancelledBy: null }) }));
  });

  it("permanently deletes a Cancelled Order and leaves Customer/Ledger untouched", async () => {
    const current = { id: "cancelled-1", status: "CANCELLED", sourceMessageId: "77", customer: { id: "customer-1", name: "စမ်းသပ် Customer" } };
    mocks.orderFindUnique.mockResolvedValue(current);
    const result = await deleteCancelledOrderPermanently({ orderId: current.id, actorName: "Staff" });
    expect(result).toEqual({ id: current.id, deleted: true });
    expect(mocks.orderDelete).toHaveBeenCalledWith({ where: { id: current.id } });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ORDER_PERMANENT_DELETE", entityType: "Order", entityId: current.id }));
  });

  it("rejects permanent deletion unless the Order is Cancelled", async () => {
    mocks.orderFindUnique.mockResolvedValue({ id: "draft-1", status: "DRAFT", customer: null });
    await expect(deleteCancelledOrderPermanently({ orderId: "draft-1" })).rejects.toThrow("Cancelled Order သာ အပြီးဖျက်");
    expect(mocks.orderDelete).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("auto-clears only expired Cancelled Orders and does not query Customer or Ledger", async () => {
    mocks.orderFindMany.mockResolvedValue([
      { id: "expired", customerId: "customer-1", cancelledAt: new Date("2026-08-01T00:00:00.000Z") },
      { id: "recent", customerId: "customer-1", cancelledAt: new Date("2026-08-20T00:00:00.000Z") },
      { id: "undated", customerId: "customer-1", cancelledAt: null },
    ]);
    const result = await purgeExpiredCancelledOrders({ now: new Date("2026-08-25T00:00:00.000Z") });
    expect(result).toEqual({ deletedCount: 1, skippedUndatedCount: 1 });
    expect(mocks.orderDelete).toHaveBeenCalledWith({ where: { id: "expired" } });
    expect(mocks.orderDelete).toHaveBeenCalledTimes(1);
    expect(mocks.auditFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ action: "ORDER_CANCEL" }) }));
  });
});
