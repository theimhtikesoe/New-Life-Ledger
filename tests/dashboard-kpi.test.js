import fs from "node:fs";
import path from "node:path";
import { vi, describe, it, expect } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  customerAggregate: vi.fn(),
  ledgerAggregate: vi.fn(),
  ledgerFindMany: vi.fn(),
  cashSaleGroupBy: vi.fn(),
  cashSaleFindMany: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  ensureDatabase: mocks.ensureDatabase,
  databaseErrorResponse: vi.fn((error) => ({ error: error?.message || "Database error" })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    customer: { aggregate: mocks.customerAggregate },
    ledger: { aggregate: mocks.ledgerAggregate, findMany: mocks.ledgerFindMany },
    cashSale: { groupBy: mocks.cashSaleGroupBy, findMany: mocks.cashSaleFindMany },
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

const dashboardSource = fs.readFileSync(path.join(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("Dashboard KPI aggregate route", () => {
  it("provides an isolated date selector for date-sensitive KPI cards", () => {
    expect(dashboardSource).toContain('id="dashboard-kpi-date"');
    expect(dashboardSource).toContain('type="date"');
    expect(dashboardSource).toContain("{!isLedgerView ? (");
    expect(dashboardSource).toContain('api(`/api/dashboard-kpi?date=${encodeURIComponent(selectedKpiDate)}`');
    expect(dashboardSource).toContain("const selectedKpiIsToday = selectedKpiDate === currentMyanmarDate;");
    expect(dashboardSource).toContain("onClick={() => setShowTodayPaymentsModal(true)}");
    expect(dashboardSource).toContain("disabled={!selectedKpiIsToday}");
    expect(dashboardSource).toContain('href={`/production-history?date=${encodeURIComponent(selectedKpiDate)}`}');
  });

  it("returns KPI totals without loading full customer or daily-summary rows", async () => {
    mocks.ensureDatabase.mockResolvedValue(undefined);
    mocks.customerAggregate.mockResolvedValue({ _count: { _all: 12 }, _sum: { current_balance: 3400000 } });
    mocks.ledgerAggregate.mockResolvedValue({ _count: { _all: 4 }, _sum: { amount: 800000 } });
    mocks.ledgerFindMany.mockResolvedValue([
      { saleItems: [{ productKey: "water-1l", productName: "ရေသန့်", capacity: 1, bottleCount: 12, totalAmount: 24000 }] },
    ]);
    mocks.queryRaw.mockResolvedValue([
      { table_name: "Ledger", column_name: "saleItems" },
      { table_name: "CashSale", column_name: "saleItems" },
    ]);
    mocks.cashSaleGroupBy.mockResolvedValue([
      { saleType: "RETAIL", _count: { _all: 2 }, _sum: { amount: 300000 } },
      { saleType: "WHOLESALE", _count: { _all: 1 }, _sum: { amount: 700000 } },
    ]);
    mocks.cashSaleFindMany.mockResolvedValue([
      { saleItems: [{ productKey: "water-1l", productName: "ရေသန့်", capacity: 1, bottleCount: 8, totalAmount: 16000 }] },
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
      bottleSales: {
        totalBottles: 20,
        totalAmount: 40000,
        items: [{ productKey: "water-1l", bottleCount: 20, totalAmount: 40000 }],
      },
    });
    expect(mocks.customerAggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
    expect(mocks.ledgerAggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ type: "DEBIT" }) }));
  });
});
