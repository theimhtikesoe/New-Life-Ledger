import { describe, expect, it } from "vitest";
import { getCapUnitCount, makeLine } from "../src/components/SalesItemPicker.jsx";

describe("piece-based cap pricing", () => {
  it("does not multiply a 20-liter cap by bag capacity", () => {
    const line = makeLine({
      productKey: "CAP_20L_BACK",
      categoryKey: "CAP",
      productType: "cap",
      productName: "အဖုံး - 20 လီတာ အဖုံး (အနောက်)",
      effectivePrice: { pricePerBottle: 400, source: "ITEM" },
    }, 10, null, "မန္တလေး", 5000, true);

    expect(line.capacity).toBe(1);
    expect(line.bottleCount).toBe(10);
    expect(line.unitCount).toBe(10);
    expect(line.totalAmount).toBe(4000);
  });

  it("uses piece quantity in the automatic preview for 20-liter caps", () => {
    const item = {
      productKey: "CAP_20L_BACK",
      categoryKey: "CAP",
      productType: "cap",
      productName: "အဖုံး - 20 လီတာ အဖုံး (အနောက်)",
    };
    const quantity = getCapUnitCount(item, 10, 5000);
    expect(quantity).toBe(10);
    expect(quantity * 400).toBe(4000);
  });
});
