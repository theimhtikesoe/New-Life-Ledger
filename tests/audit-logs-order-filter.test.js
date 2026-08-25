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
vi.mock("@/lib/audit", () => ({ ACTORS: ["ဖေဖေ", "ပုံ့ပုံ့", "ဆောင်းဦး", "Staff"] }));
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
      { NOT: { entityType: "Order" } },
      { NOT: { action: "DAILY_REPORT_SENT" } },
    ]));
    expect(mocks.auditFindMany).toHaveBeenCalledTimes(1);
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
});
