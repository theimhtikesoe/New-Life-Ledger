import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  ledgerFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  cashSaleFindMany: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  ensureDatabase: mocks.ensureDatabase,
  databaseErrorResponse: vi.fn((error) => ({ error: error?.message || "Database error" })),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { ledger: { findMany: mocks.ledgerFindMany }, cashSale: { findMany: mocks.cashSaleFindMany }, auditLog: { findMany: mocks.auditFindMany } } }));
vi.mock("@/lib/myanmar-time", () => ({ getMyanmarDayRange: vi.fn(() => ({ start: new Date("2026-08-25T00:00:00.000Z"), end: new Date("2026-08-26T00:00:00.000Z") })) }));

import { GET } from "@/app/api/daily-summary/route";

function request() {
  return new Request("http://localhost/api/daily-summary?date=2026-08-25");
}

describe("Daily Summary activity count", () => {
  it("uses the same non-Order activity scope as Activity History", async () => {
    mocks.ensureDatabase.mockResolvedValue(undefined);
    mocks.auditFindMany.mockResolvedValue([{ entityType: "Customer", entityId: "customer-1", hiddenAt: null }]);
    mocks.cashSaleFindMany.mockResolvedValue([{
      id: "cash-sale-1",
      date: new Date("2026-08-25T09:00:00.000Z"),
      saleType: "RETAIL",
      itemSize: null,
      cartons: null,
      rate: null,
      deductions: 0,
      amount: 50000,
      note: "ဆိုင်မှာ လက်ငင်းရှင်း",
      paymentType: "CASH",
      customer: { id: "customer-1", name: "ကံလီ" },
    }]);
    mocks.ledgerFindMany.mockResolvedValue([{
      id: "ledger-1",
      date: new Date("2026-08-25T08:00:00.000Z"),
      type: "CREDIT",
      amount: 100000,
      paymentType: null,
      note: null,
      customer: { id: "customer-1", name: "ကံလီ" },
    }]);

    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.summary.activityCount).toBe(2);
    expect(body.data.summary.auditCount).toBe(1);
    expect(body.data.summary.cashCount).toBe(1);
    expect(body.data.summary.cashAmount).toBe(50000);
    expect(body.data.summary.cashPaymentTypes).toEqual({ CASH: 50000 });
    expect(body.data.summary.cashSaleTypes).toEqual({ RETAIL: { count: 1, amount: 50000 }, WHOLESALE: { count: 0, amount: 0 } });
    expect(body.data.customers[0]).toMatchObject({ cashCount: 1, cashAmount: 50000, cashRetailCount: 1, cashRetailAmount: 50000, cashWholesaleCount: 0, cashWholesaleAmount: 0 });
    const auditWhere = mocks.auditFindMany.mock.calls[0][0].where;
    expect(auditWhere.AND).toEqual(expect.arrayContaining([
      { NOT: { action: "DAILY_REPORT_SENT" } },
      { NOT: { entityType: "Order" } },
    ]));
  });
});
