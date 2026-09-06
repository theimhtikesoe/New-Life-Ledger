import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditFindMany: vi.fn(),
  ledgerFindMany: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  ensureDatabase: vi.fn().mockResolvedValue(undefined),
  databaseErrorResponse: vi.fn((error) => ({ error: error?.message || "Database error" })),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { auditLog: { findMany: mocks.auditFindMany }, ledger: { findMany: mocks.ledgerFindMany } } }));
vi.mock("@/lib/audit", () => ({ ACTORS: ["ဖေဖေ", "ပုံ့ပုံ့", "ဆောင်းဦး", "Rhyzoe"] }));
vi.mock("@/lib/myanmar-time", () => ({ getMyanmarDayRange: vi.fn(() => ({ start: new Date("2026-08-25T00:00:00.000Z"), end: new Date("2026-08-26T00:00:00.000Z") })) }));

import { GET } from "@/app/api/audit-logs/route";

function request(query = "date=2026-08-25") {
  return new Request(`http://localhost/api/audit-logs?${query}`);
}

describe("Activity History Order separation", () => {
  it("excludes Order audit records by default without deleting or mutating them", async () => {
    mocks.auditFindMany.mockReset().mockResolvedValue([]);
    mocks.ledgerFindMany.mockReset().mockResolvedValue([]);
    const response = await GET(request());
    expect(response.status).toBe(200);
    const where = mocks.auditFindMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(expect.arrayContaining([
      { NOT: [
        { entityType: "Order" },
        { entityType: "OrderBatch" },
        { action: { startsWith: "ORDER_" } },
        { action: { in: ["DAILY_SALES_OPENING", "DAILY_SALES_SUMMARY"] } },
        { action: "PRODUCTION_REPORT_DELETE" },
        { action: "PRODUCTION_REPORT_SUBMIT" },
        { action: "PRODUCTION_WORKER_CREATE" },
      ] },
      { NOT: { action: "DAILY_REPORT_SENT" } },
    ]));
    expect(mocks.auditFindMany).toHaveBeenCalledTimes(1);
  });

  it("filters OrderBatch and ORDER_* records from the returned accounting list", async () => {
    mocks.auditFindMany.mockReset().mockResolvedValue([
      { id: "order", entityType: "Order", action: "ORDER_DRAFT", hiddenAt: null },
      { id: "batch", entityType: "OrderBatch", action: "ORDER_BATCH_NOTIFIED", hiddenAt: null },
      { id: "prefixed", entityType: "Operational", action: "ORDER_CUSTOM", hiddenAt: null },
      { id: "payment", entityType: "Ledger", action: "PAYMENT", entityId: "ledger-1", hiddenAt: null },
    ]);
    mocks.ledgerFindMany.mockReset().mockResolvedValue([]);
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.map((log) => log.id)).toEqual(["payment"]);
  });

  it("allows Order History to request Order audit records explicitly", async () => {
    mocks.auditFindMany.mockReset().mockResolvedValue([]);
    mocks.ledgerFindMany.mockReset().mockResolvedValue([]);
    const response = await GET(request("includeOrders=true&limit=500"));
    expect(response.status).toBe(200);
    const where = mocks.auditFindMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(expect.arrayContaining([{ NOT: { action: "DAILY_REPORT_SENT" } }]));
    expect(where.AND).not.toContainEqual({ NOT: { entityType: "Order" } });
  });

  it("excludes Customer UPDATE records when requested by Activity History", async () => {
    mocks.auditFindMany.mockReset().mockResolvedValue([
      { id: "customer-edit", entityType: "Customer", action: "UPDATE", hiddenAt: null },
      { id: "payment", entityType: "Ledger", action: "PAYMENT", hiddenAt: null },
    ]);
    mocks.ledgerFindMany.mockReset().mockResolvedValue([]);
    const response = await GET(request("excludeCustomerEdits=true&limit=500"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.map((log) => log.id)).toEqual(["payment"]);
    const where = mocks.auditFindMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ NOT: { AND: [{ entityType: "Customer" }, { action: "UPDATE" }] } });
  });
});
