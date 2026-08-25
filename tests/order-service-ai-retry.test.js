import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  orderFindUnique: vi.fn(),
  orderUpdate: vi.fn(),
  orderLineDeleteMany: vi.fn(),
  orderCapDeleteMany: vi.fn(),
  customerFindMany: vi.fn(),
  writeAuditLog: vi.fn(),
  calculateCapWarnings: vi.fn(),
  calculateMissingStatus: vi.fn(),
  calculateOrderTotals: vi.fn(),
  normalizeExtractedOrder: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ ensureDatabase: mocks.ensureDatabase }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: mocks.orderFindUnique, update: mocks.orderUpdate },
    orderLine: { deleteMany: mocks.orderLineDeleteMany },
    orderCap: { deleteMany: mocks.orderCapDeleteMany },
    customer: { findMany: mocks.customerFindMany },
    $transaction: vi.fn(async (callback) => callback({
      order: { update: mocks.orderUpdate },
      orderLine: { deleteMany: mocks.orderLineDeleteMany },
      orderCap: { deleteMany: mocks.orderCapDeleteMany },
    })),
  },
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/order-utils", () => ({
  calculateCapWarnings: mocks.calculateCapWarnings,
  calculateMissingStatus: mocks.calculateMissingStatus,
  calculateOrderTotals: mocks.calculateOrderTotals,
  normalizeExtractedOrder: mocks.normalizeExtractedOrder,
  normalizeDateInput: vi.fn(),
}));

import { refreshOrderFromAi } from "@/lib/order-service";

const orderId = "11111111-1111-4111-8111-111111111111";
const customer = { id: "22222222-2222-4222-8222-222222222222", name: "ကံလီ", phone: null, routeTag: null, deletedAt: null };
const current = {
  id: orderId,
  status: "NEEDS_CUSTOMER",
  archivedAt: null,
  sourceText: "/order ကံလီ 0.3 L 400 ဆံ့ 20 ကဒ် ပုလဲဂိတ် မနက်ဖြန်",
  requestedDate: "2026-08-26",
  destination: "ပုလဲဂိတ်",
  customer: null,
  draftCustomerName: "ကံလီ",
  customerPhone: null,
  aiNotes: null,
  lines: [],
  caps: [],
  deliveries: [],
};
const normalized = {
  customerName: "ကံလီ",
  customerPhone: null,
  requestedDate: "2026-08-26",
  destination: "ပုလဲဂိတ်",
  lines: [{ bottleType: "အပြာ", capacityMl: 300, capacityLabel: "0.3 L", bottlesPerCard: 400, cardCount: 20, totalBottles: 8000, notes: null }],
  caps: [{ capType: "အဖုံးပြာ", normalPcs: 8000, extraPcs: 20, requestedTotalPcs: 8020, notes: null }],
  missingFields: [],
  confidence: "high",
  notes: null,
};
const updated = { ...current, status: "DRAFT", customer, lines: normalized.lines, caps: normalized.caps };

describe("Order AI retry persistence", () => {
  beforeEach(() => {
    mocks.ensureDatabase.mockReset().mockResolvedValue(undefined);
    mocks.orderFindUnique.mockReset().mockResolvedValue(current);
    mocks.orderLineDeleteMany.mockReset().mockResolvedValue({ count: 0 });
    mocks.orderCapDeleteMany.mockReset().mockResolvedValue({ count: 0 });
    mocks.orderUpdate.mockReset().mockResolvedValue(updated);
    mocks.customerFindMany.mockReset().mockResolvedValue([customer]);
    mocks.writeAuditLog.mockReset().mockResolvedValue(undefined);
    mocks.calculateCapWarnings.mockReset().mockImplementation((order) => order.caps || []);
    mocks.calculateMissingStatus.mockReset().mockReturnValue("DRAFT");
    mocks.calculateOrderTotals.mockReset().mockReturnValue({ totalCards: 20, totalBottles: 8000, totalNormalCaps: 8000, totalExtraCaps: 20, totalRequestedCaps: 8020 });
    mocks.normalizeExtractedOrder.mockReset().mockReturnValue(normalized);
  });

  it("replaces only Order lines/caps and preserves the original source text", async () => {
    const result = await refreshOrderFromAi({ orderId, extracted: { customerName: "ကံလီ" }, actorName: "ဖေဖေ" });
    expect(result.id).toBe(orderId);
    expect(mocks.orderLineDeleteMany).toHaveBeenCalledWith({ where: { orderId } });
    expect(mocks.orderCapDeleteMany).toHaveBeenCalledWith({ where: { orderId } });
    expect(mocks.orderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: orderId },
      data: expect.objectContaining({
        status: "DRAFT",
        requestedDate: "2026-08-26",
        destination: "ပုလဲဂိတ်",
        lines: { create: [expect.objectContaining({ totalBottles: 8000 })] },
        caps: { create: [expect.objectContaining({ normalPcs: 8000, extraPcs: 20, requestedTotalPcs: 8020 })] },
      }),
    }));
    expect(mocks.orderUpdate.mock.calls[0][0].data).not.toHaveProperty("sourceText");
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "ORDER_AI_RETRY", entityId: orderId, actorName: "ဖေဖေ" }));
  });
});
