import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ ensureDatabase: mocks.ensureDatabase }));
vi.mock("@/lib/audit", () => ({ getActorName: () => "Test", writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/production-catalog", async () => {
  const actual = await vi.importActual("@/lib/production-catalog");
  return {
    ...actual,
    BOTTLE_GROUPS: [{ key: "square-golden", label: "လေးထောင့် / ရွှေဝိုင်း", description: "" }],
    BOTTLE_ITEMS: [{ type: "လေးထောင့် 13g", capacities: [100] }, { type: "ရွှေဝိုင်း", capacities: [100] }],
  };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    priceSetting: { upsert: mocks.upsert, deleteMany: mocks.deleteMany },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "../src/app/api/price-settings/route.js";

describe("POST /api/price-settings", () => {
  it("saves category and item costs with only PriceSetting schema fields", async () => {
    mocks.ensureDatabase.mockResolvedValue(undefined);
    mocks.upsert.mockResolvedValue({});
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback) => callback({
      priceSetting: { upsert: mocks.upsert, deleteMany: mocks.deleteMany },
    }));

    const response = await POST(new Request("http://localhost/api/price-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        priceDate: "2026-09-08",
        categoryPrices: { "square-golden": "100" },
        itemPrices: { "လေးထောင့် 13g::100": "120" },
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.count).toBe(2);
    for (const call of mocks.upsert.mock.calls) {
      expect(call[0].create).not.toHaveProperty("categoryLabel");
      expect(call[0].update).not.toHaveProperty("categoryLabel");
    }
  });
});
