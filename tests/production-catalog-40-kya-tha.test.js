import { describe, expect, it } from "vitest";
import {
  BOTTLE_ITEMS,
  BOTTLE_GROUPS,
  buildCatalog,
  getBottleGroup,
} from "@/lib/production-catalog";

describe("40 ကျပ်သား bottle catalog", () => {
  it("defines a 100 ဆံ့ bottle product", () => {
    expect(BOTTLE_ITEMS).toContainEqual({ type: "40 ကျပ်သား", capacities: [100] });
    expect(buildCatalog()).toContainEqual(expect.objectContaining({
      productKey: "40 ကျပ်သား::100",
      productType: "bottle",
      productName: "40 ကျပ်သား",
      capacity: 100,
      bottlesPerCard: 100,
      categoryKey: "40",
    }));
  });

  it("maps the product to the dedicated 40 ကျပ်သား pricing category", () => {
    expect(getBottleGroup("40 ကျပ်သား")).toBe("40");
    expect(BOTTLE_GROUPS).toContainEqual(expect.objectContaining({
      key: "40",
      label: "40 ကျပ်သား",
    }));
  });
});
