import { vi, describe, it, expect } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  customerAggregate: vi.fn(),
  ledgerAggregate: vi.fn(),
  cashSaleGroupBy: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  ensureDatabase: mocks.ensureDatabase,
  databaseErrorResponse: vi.fn((error) => ({ error: error?.message || "Database error" })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { aggregate: mocks.customerAggregate },
    ledger: { aggregate: mocks.ledgerAggregate },
    cashSale: { groupBy: mocks.cashSaleGroupBy },
  },
}));
vi.mock("@/lib/myanmar-time", () => ({
  getMyanmarDayRange: vi.fn(() => ({
    start: new Date("2026-08-26T17:30:00.000Z"),
    end: new Date("2026-08-27T17:30:00.000Z"),
    dateLabel: "2026-08-27",
  })),
}));

import { GET } from "@/app/api/dashboard-kpi/route";

describe("Dashboard KPI aggregate route", () => {
  it("returns KPI totals without loading full customer or daily-summary rows", async () => {
    mocks.ensureDatabase.mockResolvedValue(undefined);
    mocks.customerAggregate.mockResolvedValue({ _count: { _all: 12 }, _sum: { current_balance: 3400000 } });
    mocks.ledgerAggregate.mockResolvedValue({ _count: { _all: 4 }, _sum: { amount: 800000 } });
    mocks.cashSaleGroupBy.mockResolvedValue([
      { saleType: "RETAIL", _count: { _all: 2 }, _sum: { amount: 300000 } },
      { saleType: "WHOLESALE", _count: { _all: 1 }, _sum: { amount: 700000 } },
    ]);

    const response = await GET(new Request("http://localhost/api/dashboard-kpi"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      date: "2026-08-27",
      totalCustomers: 12,
      totalBalance: 3400000,
      todayPaidCount: 4,
      todayPaidAmount: 800000,
      count: 3,
      amount: 1000000,
      retailCount: 2,
      retailAmount: 300000,
      wholesaleCount: 1,
      wholesaleAmount: 700000,
    });
    expect(mocks.customerAggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
    expect(mocks.ledgerAggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ type: "DEBIT" }) }));
  });
});
