import { describe, expect, it } from "vitest";
import { aggregateStockMovements, normalizeTubeIdentity, productionMovementRows } from "@/lib/factory-stock";

describe("Tube factory stock movements", () => {
  it("normalizes Tube production labels to the same stock identity", () => {
    expect(normalizeTubeIdentity("24g W", 1500)).toMatchObject({ productName: "24g W (အဖြူ)", productKey: "24g W (အဖြူ)::1500", capacity: 1500 });
  });

  it("adds Tube production and deducts mapped Tube usage for bottle production", () => {
    const rows = productionMovementRows([
      { category: "tube", tubeG: "24g", tubeColor: "W", outputQuantity: 5, outputCapacity: 1500, reportDate: "2026-09-01", submissionId: "tube-1" },
      { category: "bottle", bottleType: "1 လီတာ ဖြူ", outputQuantity: 2, outputCapacity: 100, reportDate: "2026-09-02", submissionId: "bottle-1" },
    ], { tubeMappings: new Map([["1 လီတာ ဖြူ::100", "24g W (အဖြူ)"]]) });
    const tubeRows = rows.filter((row) => row.stockType === "TUBE");
    expect(tubeRows).toHaveLength(2);
    expect(tubeRows[0]).toMatchObject({ sourceType: "TUBE_PRODUCTION", quantityCards: 5, quantityBottles: 7500 });
    expect(tubeRows[1]).toMatchObject({ sourceType: "BOTTLE_PRODUCTION", movementType: "PRODUCTION_USE_OUT", quantityBottles: -200, productKey: "24g W (အဖြူ)::1500" });
  });

  it("reports Tube stock in pcs while retaining bottle stock in cards", () => {
    const summary = aggregateStockMovements([
      { stockType: "TUBE", productKey: "24g W (အဖြူ)::1500", productName: "24g W (အဖြူ)", capacity: 1500, movementType: "PRODUCTION_IN", quantityCards: 5, quantityBottles: 7500 },
      { stockType: "TUBE", productKey: "24g W (အဖြူ)::1500", productName: "24g W (အဖြူ)", capacity: 1500, movementType: "PRODUCTION_USE_OUT", quantityCards: 0, quantityBottles: -200 },
    ]);
    expect(summary[0]).toMatchObject({ stockType: "TUBE", productionCards: 5, productionBottles: 7500, usedBottles: 200, currentBottles: 7300 });
  });

  it("deducts good output, bottle waste, and tube damage from linked Tube stock", () => {
    const rows = productionMovementRows([
      { category: "bottle", bottleType: "1 လီတာ ပြာ", outputQuantity: 2, outputCapacity: 100, wasteQuantity: 3, tubeDamageQuantity: 4, reportDate: "2026-09-03", submissionId: "bottle-2" },
    ], { tubeMappings: new Map([["1 လီတာ ပြာ::100", "24g B (S+1)"]]) });
    expect(rows.filter((row) => row.stockType === "TUBE")[0]).toMatchObject({ movementType: "PRODUCTION_USE_OUT", quantityBottles: -207 });
    expect(rows.find((row) => row.stockType === "BOTTLE" && row.movementType === "PRODUCTION_WASTE_OUT")).toMatchObject({ quantityBottles: -3 });
  });
});
