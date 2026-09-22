import { describe, expect, it } from "vitest";
import { calculatePackagingBags, packagingRuleFor } from "@/lib/packaging-bag-calculator";

describe("packaging bag calculator", () => {
  it("maps a .3 400-card to one 38×58 bag", () => {
    expect(packagingRuleFor({ bottleType: "0.3 ဖြူ", outputCapacity: 400 })?.bagSize).toBe("38×58");
    expect(calculatePackagingBags([{ bottleType: "0.3 ဖြူ", outputCapacity: 400, outputQuantity: 1 }]).groups[0].cards).toBe(1);
  });
  it("aggregates all mapped cards by bag size", () => {
    const result = calculatePackagingBags([
      { bottleType: "1 လီတာ ဖြူ", outputCapacity: 160, outputQuantity: 2 },
      { bottleType: "1 လီတာ ဖြူ", outputCapacity: 100, outputQuantity: 3 },
      { bottleType: "ရွှေဝိုင်း", outputCapacity: 200, outputQuantity: 4 },
    ]);
    expect(result.totalBags).toBe(9);
    expect(result.groups.find((group) => group.bagSize === "38×58").cards).toBe(2);
    expect(result.groups.find((group) => group.bagSize === "38×40").cards).toBe(3);
    expect(result.groups.find((group) => group.bagSize === "37×37").cards).toBe(4);
  });
  it("keeps unsupported rows visible instead of silently counting them", () => {
    const result = calculatePackagingBags([{ bottleType: "မသိသေး", outputCapacity: 100, outputQuantity: 2 }]);
    expect(result.totalBags).toBe(0);
    expect(result.unassigned).toHaveLength(1);
  });
});
