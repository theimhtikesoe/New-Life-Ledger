import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  ledgerFindMany: vi.fn(),
  auditFindMany: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  ensureDatabase: mocks.ensureDatabase,
  databaseErrorResponse: vi.fn((error) => ({ error: error?.message || "Database error" })),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { ledger: { findMany: mocks.ledgerFindMany }, auditLog: { findMany: mocks.auditFindMany } } }));
vi.mock("@/lib/myanmar-time", () => ({ getMyanmarDayRange: vi.fn(() => ({ start: new Date("2026-08-25T00:00:00.000Z"), end: new Date("2026-08-26T00:00:00.000Z") })) }));

import { GET } from "@/app/api/daily-summary/route";

function request() {
  return new Request("http://localhost/api/daily-summary?date=2026-08-25");
}

describe("Daily Summary activity count", () => {
  it("uses the same non-Order activity scope as Activity History", async () => {
    mocks.ensureDatabase.mockResolvedValue(undefined);
    mocks.auditFindMany.mockResolvedValue([{ entityType: "Customer", entityId: "customer-1" }]);
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
    const auditWhere = mocks.auditFindMany.mock.calls[0][0].where;
    expect(auditWhere.AND).toEqual(expect.arrayContaining([
      { NOT: { action: "DAILY_REPORT_SENT" } },
      { NOT: { entityType: "Order" } },
    ]));
  });
});
