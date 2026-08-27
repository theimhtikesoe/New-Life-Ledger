import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  findLedger: vi.fn(),
  findCashSale: vi.fn(),
  findAudit: vi.fn(),
  getPreviousMyanmarDayRanges: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  ensureDatabase: mocks.ensureDatabase,
  databaseErrorResponse: (error) => ({ error: String(error?.message || error) }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ledger: { findMany: mocks.findLedger },
    cashSale: { findMany: mocks.findCashSale },
    auditLog: { findMany: mocks.findAudit },
  },
}));
vi.mock("@/lib/myanmar-time", () => ({
  getPreviousMyanmarDayRanges: mocks.getPreviousMyanmarDayRanges,
}));
vi.mock("@/lib/accounting-activity", () => ({
  accountingAuditLogWhere: () => ({}),
}));
vi.mock("@/lib/cash-sale-utils", () => ({
  normalizeCashSaleType: (value) => String(value || "RETAIL").toUpperCase() === "WHOLESALE" ? "WHOLESALE" : "RETAIL",
}));

import { GET } from "@/app/api/dashboard-pulse/route";

const day = (dateLabel) => {
  const start = new Date(`${dateLabel}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { dateLabel, start, end };
};

describe("Dashboard Ledger Pulse API", () => {
  beforeEach(() => {
    mocks.ensureDatabase.mockReset();
    mocks.findLedger.mockReset().mockResolvedValue([]);
    mocks.findCashSale.mockReset().mockResolvedValue([]);
    mocks.findAudit.mockReset().mockResolvedValue([]);
    mocks.getPreviousMyanmarDayRanges.mockReset().mockReturnValue([
      day("2026-08-24"),
      day("2026-08-25"),
      day("2026-08-26"),
    ]);
  });

  it("groups paid, debt, cash sale, and accounting activity by day", async () => {
    mocks.findLedger.mockResolvedValue([
      { id: "paid-1", date: new Date("2026-08-25T12:00:00.000Z"), type: "DEBIT", amount: 1000 },
      { id: "debt-1", date: new Date("2026-08-25T13:00:00.000Z"), type: "CREDIT", amount: 2500 },
      { id: "paid-2", date: new Date("2026-08-26T12:00:00.000Z"), type: "DEBIT", amount: 700 },
    ]);
    mocks.findCashSale.mockResolvedValue([
      { date: new Date("2026-08-25T14:00:00.000Z"), saleType: "WHOLESALE", amount: 9000 },
      { date: new Date("2026-08-26T14:00:00.000Z"), saleType: "RETAIL", amount: 4000 },
    ]);
    mocks.findAudit.mockResolvedValue([
      { createdAt: new Date("2026-08-25T15:00:00.000Z"), entityType: "Ledger", entityId: "paid-1", hiddenAt: null },
      { createdAt: new Date("2026-08-25T16:00:00.000Z"), entityType: "Customer", entityId: "customer-1", hiddenAt: null },
    ]);

    const response = await GET(new Request("http://localhost/api/dashboard-pulse?days=3"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.days).toEqual([
      expect.objectContaining({ date: "2026-08-24", paidCount: 0, debtCount: 0, cashCount: 0, activityCount: 0 }),
      expect.objectContaining({
        date: "2026-08-25",
        paidCount: 1,
        paidAmount: 1000,
        debtCount: 1,
        debtAmount: 2500,
        cashCount: 1,
        cashAmount: 9000,
        cashWholesaleCount: 1,
        cashRetailCount: 0,
        activityCount: 3,
      }),
      expect.objectContaining({
        date: "2026-08-26",
        paidCount: 1,
        paidAmount: 700,
        cashCount: 1,
        cashAmount: 4000,
        cashRetailCount: 1,
        activityCount: 1,
      }),
    ]);
    expect(body.data.totals).toEqual({
      paidCount: 2,
      paidAmount: 1700,
      debtCount: 1,
      debtAmount: 2500,
      cashCount: 2,
      cashAmount: 13000,
      activityCount: 4,
    });
  });

  it("never returns order-only audit activity in the accounting pulse", async () => {
    mocks.findAudit.mockResolvedValue([
      { createdAt: new Date("2026-08-25T15:00:00.000Z"), entityType: "Order", entityId: "order-1", hiddenAt: null },
    ]);

    const response = await GET(new Request("http://localhost/api/dashboard-pulse?days=3"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.totals.activityCount).toBe(0);
  });
});
