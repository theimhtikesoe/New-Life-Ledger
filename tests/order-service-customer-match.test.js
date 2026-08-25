import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  customerFindMany: vi.fn(),
  orderCreate: vi.fn(),
  writeAuditLog: vi.fn(),
  calculateCapWarnings: vi.fn(),
  calculateMissingStatus: vi.fn(),
  calculateOrderTotals: vi.fn(),
  normalizeExtractedOrder: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ ensureDatabase: mocks.ensureDatabase }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findMany: mocks.customerFindMany },
    order: { create: mocks.orderCreate },
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

import { createOrderDraft } from "@/lib/order-service";

const customer = { id: "customer-1", name: "3 ဘီး (ဟိုပုံး)", phone: null, routeTag: null, deletedAt: null };
const normalized = {
  customerName: "3ဘီး",
  customerPhone: null,
  requestedDate: "2026-08-27",
  destination: "စက်ရုံလာယူမည်",
  lines: [{ bottleType: "နွားနို့ကြီး အဖြူ", capacityMl: 300, capacityLabel: "0.3 Liter", bottlesPerCard: 100, cardCount: 30, totalBottles: 3000, notes: null }],
  caps: [{ capType: "ရောင်စုံ", normalPcs: 3000, extraPcs: 15, requestedTotalPcs: 3015, notes: null }],
  missingFields: [],
  confidence: "low",
  notes: "စက်ရုံလာယူမည် ၊ လာယူချိန်: မနက်ဖြန် မနက် ၇ နာရီ ခွဲ",
};
const created = { id: "order-1", status: "DRAFT", customer, lines: normalized.lines, caps: normalized.caps, missingFields: [], sourceText: "မှာယူမှု 3ဘီး" };

describe("Telegram order customer matching", () => {
  beforeEach(() => {
    mocks.ensureDatabase.mockReset().mockResolvedValue(undefined);
    mocks.customerFindMany.mockReset().mockResolvedValue([customer]);
    mocks.orderCreate.mockReset().mockResolvedValue(created);
    mocks.writeAuditLog.mockReset().mockResolvedValue(undefined);
    mocks.calculateCapWarnings.mockReset().mockImplementation((order) => order.caps || []);
    mocks.calculateMissingStatus.mockReset().mockReturnValue("DRAFT");
    mocks.calculateOrderTotals.mockReset().mockReturnValue({ totalCards: 30, totalBottles: 3000, totalNormalCaps: 3000, totalExtraCaps: 15 });
    mocks.normalizeExtractedOrder.mockReset().mockReturnValue(normalized);
  });

  it("links 3ဘီး to the one active customer named 3 ဘီး (ဟိုပုံး)", async () => {
    const result = await createOrderDraft({ sourceText: "မှာယူမှု 3ဘီး", extracted: normalized });
    expect(result.order.customer).toEqual(customer);
    expect(result.order.status).toBe("DRAFT");
    expect(mocks.customerFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.arrayContaining([{ name: { contains: "3", mode: "insensitive" } }]) }),
    }));
    expect(mocks.orderCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ customerId: customer.id, draftCustomerName: null }) }));
  });
});
