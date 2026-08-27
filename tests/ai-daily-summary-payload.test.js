import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  ledgerFindMany: vi.fn(),
  cashSaleFindMany: vi.fn(),
  auditFindMany: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ ensureDatabase: mocks.ensureDatabase }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ledger: { findMany: mocks.ledgerFindMany },
    cashSale: { findMany: mocks.cashSaleFindMany },
    auditLog: { findMany: mocks.auditFindMany },
  },
}));
vi.mock("@/lib/myanmar-time", () => ({
  getMyanmarDayRange: vi.fn(() => ({
    start: new Date("2026-08-25T00:00:00.000Z"),
    end: new Date("2026-08-26T00:00:00.000Z"),
    dateLabel: "2026-08-25",
  })),
}));

import { getAiDailySummaryPayload } from "@/lib/ai-daily-summary";

describe("AI Daily Summary accounting activity scope", () => {
  beforeEach(() => {
    mocks.ensureDatabase.mockReset().mockResolvedValue(undefined);
    mocks.ledgerFindMany.mockReset().mockResolvedValue([]);
    mocks.cashSaleFindMany.mockReset().mockResolvedValue([]);
    mocks.auditFindMany.mockReset().mockResolvedValue([
      { action: "ORDER_DRAFT", entityType: "Order", entityId: "order-1", entityLabel: "Order", createdAt: new Date("2026-08-25T01:00:00.000Z"), hiddenAt: null },
      { action: "ORDER_BATCH_NOTIFIED", entityType: "OrderBatch", entityId: "batch-1", entityLabel: "OrderBatch", createdAt: new Date("2026-08-25T02:00:00.000Z"), hiddenAt: null },
      { action: "ORDER_CUSTOM", entityType: "Operational", entityId: "op-1", entityLabel: "Order", createdAt: new Date("2026-08-25T03:00:00.000Z"), hiddenAt: null },
      { action: "UPDATE", entityType: "Customer", entityId: "customer-1", entityLabel: "ကံလီ", createdAt: new Date("2026-08-25T04:00:00.000Z"), hiddenAt: null },
    ]);
  });

  it("excludes Order entity, OrderBatch entity, and ORDER-prefixed actions", async () => {
    const payload = await getAiDailySummaryPayload("2026-08-25");
    expect(payload.genuineActivity.events).toEqual([
      expect.objectContaining({ action: "Customer ပြင်ဆင်", entityType: "Customer", customerName: "ကံလီ" }),
    ]);
    expect(payload.genuineActivity.total).toBe(1);
  });
});
