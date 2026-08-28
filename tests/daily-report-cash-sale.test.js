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

import { formatCashSaleDetails, getDailyReportData } from "@/lib/daily-report";

const period = {
  start: new Date("2026-08-25T00:00:00.000Z"),
  end: new Date("2026-08-26T00:00:00.000Z"),
  dateLabel: "2026-08-25",
};

const ledger = {
  id: "ledger-1",
  date: new Date("2026-08-25T08:00:00.000Z"),
  createdAt: new Date("2026-08-25T08:00:00.000Z"),
  type: "CREDIT",
  saleType: "WHOLESALE",
  itemSize: "0.3 Liter",
  cartons: 10,
  rate: 100,
  deductions: 0,
  amount: 100000,
  note: null,
  paymentType: null,
  customer: { id: "customer-1", name: "အကြွေး Customer" },
};

const cashSale = {
  id: "cash-sale-1",
  date: new Date("2026-08-25T09:00:00.000Z"),
  saleType: "WHOLESALE",
  amount: 50000,
  paymentType: "KPay",
  customer: { id: "customer-2", name: "လက်ငင်း Customer" },
};

beforeEach(() => {
  mocks.ensureDatabase.mockReset().mockResolvedValue(undefined);
  mocks.ledgerFindMany.mockReset().mockResolvedValue([ledger]);
  mocks.cashSaleFindMany.mockReset().mockResolvedValue([cashSale]);
  mocks.auditFindMany.mockReset().mockResolvedValue([
    { id: "audit-ledger-1", actorName: "Staff", action: "DEBT_INCREASE", entityType: "Ledger", entityId: "ledger-1", entityLabel: "အကြွေး Customer", summary: "အကြွေး Customer အကြွေးတိုး 100,000 Ks", metadata: {}, createdAt: ledger.createdAt, hiddenAt: null },
    { id: "audit-cash-sale-1", actorName: "Staff", action: "CASH_SALE", entityType: "CashSale", entityId: "cash-sale-1", entityLabel: "လက်ငင်း Customer", summary: "လက်ငင်း Customer လက်ငင်းရောင်း 50,000 Ks", metadata: { amount: 50000, paymentType: "KPay" }, createdAt: cashSale.date, hiddenAt: null },
  ]);
});

describe("Telegram daily report CashSale data", () => {
  it("renders retail and wholesale cash-sale details on separate full lines", () => {
    expect(formatCashSaleDetails({
      cashRetailCount: 4,
      cashRetailAmount: 162000,
      cashWholesaleCount: 1,
      cashWholesaleAmount: 415000,
    })).toBe("လက်လီ 4 / 162,000 Ks<br>လက်ကား 1 / 415,000 Ks");
  });

  it("keeps cash sales separate from debt totals and includes one activity event", async () => {
    const report = await getDailyReportData(period);
    expect(report.summary).toMatchObject({
      paidCount: 0,
      debtCount: 1,
      debtAmount: 100000,
      cashCount: 1,
      cashAmount: 50000,
      totalTransactions: 1,
      cashPaymentTypes: { KPay: 50000 },
      cashSaleTypes: { RETAIL: { count: 0, amount: 0 }, WHOLESALE: { count: 1, amount: 50000 } },
    });
    expect(report.customers).toEqual(expect.arrayContaining([
      expect.objectContaining({ customerName: "လက်ငင်း Customer", paidCount: 0, debtCount: 0, cashCount: 1, cashAmount: 50000, cashRetailCount: 0, cashWholesaleCount: 1, cashWholesaleAmount: 50000 }),
    ]));
    expect(report.activityLogs.filter((log) => log.entityType === "CashSale")).toHaveLength(1);
    expect(report.activityLogs.find((log) => log.entityType === "CashSale")).toMatchObject({ action: "CASH_SALE", entityLabel: "လက်ငင်း Customer" });
  });

  it("uses the accounting-only Activity History scope and excludes Order workflow records", async () => {
    mocks.auditFindMany.mockResolvedValue([
      { id: "order", action: "ORDER_DRAFT", entityType: "Order", entityId: "order-1", hiddenAt: null, createdAt: ledger.createdAt },
      { id: "batch", action: "ORDER_BATCH_NOTIFIED", entityType: "OrderBatch", entityId: "batch-1", hiddenAt: null, createdAt: ledger.createdAt },
      { id: "prefixed", action: "ORDER_CUSTOM", entityType: "Operational", entityId: "op-1", hiddenAt: null, createdAt: ledger.createdAt },
      { id: "payment", actorName: "Staff", action: "DEBT_INCREASE", entityType: "Ledger", entityId: "ledger-1", entityLabel: "အကြွေး Customer", summary: "အကြွေး Customer အကြွေးတိုး 100,000 Ks", metadata: {}, createdAt: ledger.createdAt, hiddenAt: null },
    ]);
    const report = await getDailyReportData(period);
    expect(report.activityLogs.some((log) => String(log.action).startsWith("ORDER_"))).toBe(false);
    expect(report.activityLogs.some((log) => log.entityType === "OrderBatch")).toBe(false);
    const where = mocks.auditFindMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(expect.arrayContaining([
      { NOT: { action: "DAILY_REPORT_SENT" } },
      { NOT: [
        { entityType: "Order" },
        { entityType: "OrderBatch" },
        { action: { startsWith: "ORDER_" } },
        { action: { in: ["DAILY_SALES_OPENING", "DAILY_SALES_SUMMARY"] } },
      ] },
    ]));
  });
});
