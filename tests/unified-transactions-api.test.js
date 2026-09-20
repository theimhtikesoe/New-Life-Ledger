import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  ledgerFindMany: vi.fn(),
  ledgerCount: vi.fn(),
  cashSaleFindMany: vi.fn(),
  cashSaleCount: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  ensureDatabase: mocks.ensureDatabase,
  databaseErrorResponse: (error) => ({ error: error.message }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ledger: { findMany: mocks.ledgerFindMany, count: mocks.ledgerCount },
    cashSale: { findMany: mocks.cashSaleFindMany, count: mocks.cashSaleCount },
  },
}));

import { GET } from "@/app/api/customers/[id]/transactions/unified/route";

const request = (query = "") => new Request(`http://localhost/api/customers/customer-1/transactions/unified${query}`);
const params = { params: { id: "customer-1" } };
const row = (id, createdAt, extra = {}) => ({ id, createdAt: new Date(createdAt), date: new Date(createdAt), amount: 100, ...extra });

beforeEach(() => {
  mocks.ensureDatabase.mockReset().mockResolvedValue(undefined);
  mocks.ledgerFindMany.mockReset();
  mocks.cashSaleFindMany.mockReset();
  mocks.ledgerCount.mockReset().mockResolvedValue(2);
  mocks.cashSaleCount.mockReset().mockResolvedValue(2);
});

describe("Unified customer transactions API", () => {
  it("merges Ledger and CashSale rows in one newest-first page", async () => {
    mocks.ledgerFindMany.mockResolvedValue([row("ledger-1", "2026-09-20T10:00:00.000Z", { type: "CREDIT" })]);
    mocks.cashSaleFindMany.mockResolvedValue([row("cash-1", "2026-09-20T11:00:00.000Z")]);

    const response = await GET(request("?limit=2&includeCount=true"), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items.map((item) => item.id)).toEqual(["cash-1", "ledger-1"]);
    expect(body.data.items[0]).toMatchObject({ type: "CASH_SALE", recordType: "CASH_SALE" });
    expect(body.data.pagination).toMatchObject({ limit: 2, total: 4, hasMore: false, nextCursor: null });
    expect(mocks.ledgerFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
    expect(mocks.cashSaleFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
  });

  it("uses the last merged row as an opaque cursor for the next page", async () => {
    mocks.ledgerFindMany.mockResolvedValue([row("ledger-2", "2026-09-19T10:00:00.000Z")]);
    mocks.cashSaleFindMany.mockResolvedValue([row("cash-2", "2026-09-19T09:00:00.000Z")]);

    const firstResponse = await GET(request("?limit=1"), params);
    const firstBody = await firstResponse.json();
    const cursor = firstBody.data.pagination.nextCursor;

    expect(cursor).toBeTruthy();
    expect(() => JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))).not.toThrow();

    mocks.ledgerFindMany.mockResolvedValue([]);
    mocks.cashSaleFindMany.mockResolvedValue([]);
    await GET(request(`?limit=1&cursor=${encodeURIComponent(cursor)}`), params);

    const ledgerWhere = mocks.ledgerFindMany.mock.calls[1][0].where;
    expect(ledgerWhere.customerId).toBe("customer-1");
    expect(ledgerWhere.OR).toHaveLength(2);
    expect(mocks.ledgerCount).not.toHaveBeenCalled();
    expect(mocks.cashSaleCount).not.toHaveBeenCalled();
  });
});
