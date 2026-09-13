import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { BOTTLE_ITEMS, getBottleDisplayName, getBottleGroup, normalizeBottleProductKey, normalizeBottleType, buildCatalog } from "@/lib/production-catalog";
import { normalizeBottleIdentity } from "@/lib/factory-stock";

const pricePage = fs.readFileSync("src/app/price-settings/page.js", "utf8");
const priceRoute = fs.readFileSync("src/app/api/price-settings/route.js", "utf8");

describe(".6 blue bottle variants", () => {
  it("contains separate 100 and 250 cards for S+1 and S+S", () => {
    expect(BOTTLE_ITEMS).toContainEqual({ type: "0.6 ပြာ (S+1)", capacities: [100, 250] });
    expect(BOTTLE_ITEMS).toContainEqual({ type: "0.6 ပြာ (S+S)", capacities: [100, 250] });
    expect(buildCatalog().filter((item) => item.productName.startsWith("0.6 ပြာ"))).toHaveLength(4);
    expect(getBottleGroup("0.6 ပြာ (S+S)")).toBe("06");
  });

  it("recognizes legacy .6 blue records as S+1", () => {
    expect(normalizeBottleType("0.6 ပြာ")).toBe("0.6 ပြာ (S+1)");
    expect(getBottleDisplayName("0.6 ပြာ")).toBe("0.6 ပြာ (S+1)");
    expect(normalizeBottleProductKey("0.6 ပြာ::250")).toBe("0.6 ပြာ (S+1)::250");
    expect(normalizeBottleIdentity({ productName: "0.6 ပြာ", capacity: 250 })).toMatchObject({ productName: "0.6 ပြာ (S+1)", productKey: "0.6 ပြာ (S+1)::250" });
  });

  it("keeps price settings item cards and legacy price lookup connected", () => {
    expect(pricePage).toContain("setCatalog(Array.isArray(data.catalog) ? data.catalog : [])");
    expect(priceRoute).toContain("normalizeBottleProductKey");
  });
});
