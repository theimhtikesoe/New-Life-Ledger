import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestHasValidSession: vi.fn(),
  ensureDatabase: vi.fn(),
  executeRawUnsafe: vi.fn(),
  queryRawUnsafe: vi.fn(),
  orderCount: vi.fn(),
  customerCount: vi.fn(),
  ledgerCount: vi.fn(),
  customerAggregate: vi.fn(),
  ledgerAggregate: vi.fn(),
}));

vi.mock("@/lib/auth-session", () => ({ requestHasValidSession: mocks.requestHasValidSession }));
vi.mock("@/lib/database", () => ({ ensureDatabase: mocks.ensureDatabase }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRawUnsafe: mocks.executeRawUnsafe,
    $queryRawUnsafe: mocks.queryRawUnsafe,
    order: { count: mocks.orderCount },
    customer: { count: mocks.customerCount, aggregate: mocks.customerAggregate },
    ledger: { count: mocks.ledgerCount, aggregate: mocks.ledgerAggregate },
  },
}));

import { GET } from "@/app/api/admin/ai-explanation-cache-migration/route";

function request() {
  return new Request("http://localhost/api/admin/ai-explanation-cache-migration");
}

describe("AI explanation cache migration runner", () => {
  beforeEach(() => {
    mocks.requestHasValidSession.mockReset().mockResolvedValue(true);
    mocks.ensureDatabase.mockReset().mockResolvedValue(undefined);
    mocks.executeRawUnsafe.mockReset().mockResolvedValue(0);
    mocks.queryRawUnsafe.mockReset()
      .mockResolvedValueOnce([
        ...["id", "reportDate", "dataFingerprint", "promptVersion", "explanation", "generatedBy", "provider", "model", "createdAt", "updatedAt"].map((column_name) => ({ column_name })),
      ])
      .mockResolvedValueOnce([
        ...["AiExplanationCache_pkey", "AiExplanationCache_reportDate_dataFingerprint_promptVersion_key", "AiExplanationCache_reportDate_idx", "AiExplanationCache_reportDate_updatedAt_idx"].map((indexname) => ({ indexname })),
      ]);
    mocks.orderCount.mockReset().mockResolvedValue(2);
    mocks.customerCount.mockReset().mockResolvedValue(173);
    mocks.ledgerCount.mockReset().mockResolvedValue(1249);
    mocks.customerAggregate.mockReset().mockResolvedValue({ _sum: { current_balance: 14242250 } });
    mocks.ledgerAggregate.mockReset().mockResolvedValue({ _sum: { amount: 123456789 } });
  });

  it("rejects callers without a valid website session before touching the database", async () => {
    mocks.requestHasValidSession.mockResolvedValue(false);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.ensureDatabase).not.toHaveBeenCalled();
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("runs only additive cache SQL and reports unchanged business data", async () => {
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ ok: true, migration: "ai-explanation-cache", schemaVerified: true, dataUnchanged: true }));
    expect(mocks.executeRawUnsafe).toHaveBeenCalledTimes(4);
    const sql = mocks.executeRawUnsafe.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "AiExplanationCache"');
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
    expect(sql).not.toMatch(/DROP|TRUNCATE|DELETE FROM/i);
    expect(body.before).toEqual(body.after);
    expect(body.before).toEqual(expect.objectContaining({ orders: 2, customers: 173, ledger: 1249, customerBalanceTotal: 14242250 }));
  });
});
