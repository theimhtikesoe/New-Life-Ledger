import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { normalizeTubeIdentity, saleMovementRows } from "@/lib/factory-stock";
import { TUBE_BY_MACHINE } from "@/lib/production-catalog";

describe("Tube .3 ပြာ (S+1) and no-cap sales", () => {
  it("keeps .3 ပြာ (S+1) in Production Tube metrics, not the ledger Tube catalog", () => {
    expect(TUBE_BY_MACHINE.TB2.some((item) => item.label === ".3 ပြာ (S+1)")).toBe(false);
    const productionSource = fs.readFileSync("src/components/ProductionEntryPage.jsx", "utf8");
    expect(productionSource).toContain('<option value=".3 ပြာ (S+1)">.3 ပြာ (S+1)</option>');
    expect(normalizeTubeIdentity(".3 B (S+1)")).toMatchObject({ productName: ".3 ပြာ (S+1)", capacity: 2500, productKey: ".3 ပြာ (S+1)::2500" });
  });

  it("does not create cap stock deductions for an အဖုံးမပါ bottle sale", () => {
    const rows = saleMovementRows([{
      id: "sale-no-cap",
      date: new Date("2026-09-12T00:00:00.000Z"),
      saleItems: [{
        productName: "ဒိန်ကြီး",
        productKey: "ဒိန်ကြီး::200",
        productType: "bottle",
        categoryKey: "yogurt",
        capacity: 200,
        cardCount: 30,
        bottleCount: 6000,
        capLocation: "အဖုံးမပါ",
        capDeliveryMode: "NONE",
        capProductKey: "CAP_BLACK",
        capNormalCount: 6000,
        capBreakdown: [{ capProductKey: "CAP_BLACK", capProductName: "အဖုံး - အမဲ", count: 6000 }],
      }],
    }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ stockType: "BOTTLE", quantityBottles: -6000 });
    expect(rows.some((row) => row.stockType === "CAP")).toBe(false);
  });
});
