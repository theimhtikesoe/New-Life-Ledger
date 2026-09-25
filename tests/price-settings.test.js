import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
  findMany: vi.fn(),
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
    priceSetting: { upsert: mocks.upsert, deleteMany: mocks.deleteMany, createMany: mocks.createMany, findMany: mocks.findMany },
    $transaction: mocks.transaction,
  },
}));

import { GET, POST } from "../src/app/api/price-settings/route.js";
import fs from "node:fs";

const priceRouteSource = fs.readFileSync(new URL("../src/app/api/price-settings/route.js", import.meta.url), "utf8");
const pricePageSource = fs.readFileSync(new URL("../src/app/price-settings/page.js", import.meta.url), "utf8");

describe("POST /api/price-settings", () => {
  it("accepts carried-forward latest category and item prices in the page", () => {
    expect(pricePageSource).toContain('String(item.effectivePrice?.source || "").includes("CATEGORY")');
    expect(pricePageSource).toContain('String(item.effectivePrice?.source || "").includes("ITEM")');
  });

  it("does not let mapping-only zero-price rows hide category prices", () => {
    expect(priceRouteSource).toContain("function hasAnyPrice(row)");
    expect(priceRouteSource).toContain("const effective = itemPrice || categoryPrice || null");
  });

  it("saves category and item costs with only PriceSetting schema fields", async () => {
    mocks.ensureDatabase.mockResolvedValue(undefined);
    mocks.upsert.mockResolvedValue({});
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    mocks.createMany.mockResolvedValue({ count: 2 });
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.transaction.mockResolvedValue([{ count: 0 }, { count: 2 }]);

    const response = await POST(new Request("http://localhost/api/price-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        priceDate: "2026-09-08",
        categoryPrices: { "square-golden": "100" },
        itemPrices: { "လေးထောင့် 13g::100": "120" },
        tubeMappings: { "လေးထောင့် 13g::100": "1 လီတာ ဖြူ" },
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.count).toBe(4);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.createMany.mock.calls[0][0].data[0]).not.toHaveProperty("categoryLabel");
    expect(mocks.createMany.mock.calls[0][0].data.find((row) => row.scope === "ITEM").tubeType).toBe("1 လီတာ ဖြူ");
  });
});

describe("GET /api/price-settings historical fallback", () => {
  it("uses the latest saved category price for an old ledger date", async () => {
    mocks.ensureDatabase.mockResolvedValue(undefined);
    mocks.findMany.mockImplementation(({ where } = {}) => {
      if (where?.priceDate === "2025-01-01" || where?.priceDate?.lte === "2025-01-01") return Promise.resolve([]);
      return Promise.resolve([{
        id: 1,
        priceDate: "2026-09-18",
        scope: "CATEGORY",
        categoryKey: "40",
        productKey: "40",
        productType: "bottle",
        productName: "40 ကျပ်သား",
        capacity: 0,
        bottlesPerCard: 0,
        pricePerBottle: 123,
        pricePerCard: 123,
        tubeType: null,
        updatedAt: new Date("2026-09-18T00:00:00Z"),
      }]);
    });
    const response = await GET(new Request("http://localhost/api/price-settings?date=2025-01-01"));
    const body = await response.json();
    const item = body.data.catalog.find((entry) => entry.productKey === "40 ကျပ်သား::100");
    expect(response.status).toBe(200);
    expect(item.effectivePrice).toMatchObject({ pricePerBottle: 123, source: "LATEST_CATEGORY" });
  });

  it("carries today's saved price into the next day when no next-day price exists", async () => {
    mocks.ensureDatabase.mockResolvedValue(undefined);
    mocks.findMany.mockResolvedValue([{
      id: 2,
      priceDate: "2026-09-25",
      scope: "CATEGORY",
      categoryKey: "40",
      productKey: "40",
      productType: "bottle",
      productName: "40 ကျပ်သား",
      capacity: 0,
      bottlesPerCard: 0,
      pricePerBottle: 456,
      pricePerCard: 456,
      tubeType: null,
      updatedAt: new Date("2026-09-25T00:00:00Z"),
    }]);

    const response = await GET(new Request("http://localhost/api/price-settings?date=2026-09-26"));
    const body = await response.json();
    const item = body.data.catalog.find((entry) => entry.productKey === "40 ကျပ်သား::100");
    expect(response.status).toBe(200);
    expect(item.effectivePrice).toMatchObject({ pricePerBottle: 456, source: "LATEST_CATEGORY" });
  });
});
