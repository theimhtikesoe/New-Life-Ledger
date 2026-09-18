import { describe, expect, it } from "vitest";
import {
  TUBE_BY_MACHINE,
  TUBE_ITEMS,
  TUBE_PRODUCT_TYPES,
  buildCatalog,
} from "@/lib/production-catalog";
import { normalizeTubeIdentity } from "@/lib/factory-stock";
import fs from "node:fs";

const productionSource = fs.readFileSync("src/components/ProductionEntryPage.jsx", "utf8");

describe("24g B (S+S) Tube catalog", () => {
  it("registers the blue 1500 pcs/bag item on TB1", () => {
    expect(TUBE_BY_MACHINE.TB1).toContainEqual({ g: "24g", color: "B (S+S)", pcsPerBag: 1500, label: "24g B (S+S)" });
    expect(TUBE_PRODUCT_TYPES).toContain("24g B (S+S)");
    expect(TUBE_ITEMS).toContainEqual(expect.objectContaining({ productKey: "24g B (S+S)::1500", productName: "24g B (S+S)", capacity: 1500, bottlesPerCard: 1500 }));
  });

  it("exposes the item through the shared price and sales catalog", () => {
    expect(buildCatalog()).toContainEqual(expect.objectContaining({ productKey: "24g B (S+S)::1500", productType: "tube", categoryKey: "TUBE" }));
    expect(productionSource).toContain("TUBE_BY_MACHINE");
    expect(productionSource).toContain("tubeColor: item.color");
  });

  it("keeps the blue S+S Tube separate in stock movements", () => {
    expect(normalizeTubeIdentity("24g B (S+S)", 1500)).toMatchObject({
      productName: "24g B (S+S)",
      productKey: "24g B (S+S)::1500",
      capacity: 1500,
    });
  });
});
