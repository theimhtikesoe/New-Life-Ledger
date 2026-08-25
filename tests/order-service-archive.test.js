import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  orderFindMany: vi.fn(),
  orderFindUnique: vi.fn(),
  orderUpdate: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ ensureDatabase: mocks.ensureDatabase }));
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findMany: mocks.orderFindMany, findUnique: mocks.orderFindUnique, update: mocks.orderUpdate } } }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/order-utils", () => ({
  calculateCapWarnings: vi.fn(() => []),
  calculateMissingStatus: vi.fn(),
  calculateOrderTotals: vi.fn(() => ({ totalCards: 0, totalBottles: 0, totalNormalCaps: 0, totalExtraCaps: 0 })),
  normalizeExtractedOrder: vi.fn(),
  normalizeDateInput: vi.fn(),
}));

import { archiveOrder, listOrders, restoreOrder } from "@/lib/order-service";

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
    mocks.writeAuditLog.mockReset().mockResolvedValue(undefined);
  });

  it("lists only active orders by default and archived orders when requested", async () => {
    await listOrders();
    expect(mocks.orderFindMany.mock.calls[0][0].where).toEqual({ archivedAt: null });
    await listOrders({ archivedOnly: true });
    expect(mocks.orderFindMany.mock.calls[1][0].where).toEqual({ archivedAt: { not: null } });
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
});
