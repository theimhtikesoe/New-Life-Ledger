import { describe, expect, it } from "vitest";
import { calculatePackagingBags, packagingPiecesFromSacks, packagingRuleFor, packagingSacksFromPieces } from "@/lib/packaging-bag-calculator";

describe("packaging bag calculator", () => {
  it("maps a .3 400-card to one 38×58 bag", () => {
    expect(packagingRuleFor({ bottleType: "0.3 ဖြူ", outputCapacity: 400 })?.bagSize).toBe("38×58");
    expect(packagingRuleFor({ bottleType: "0.3 ဖြူ", outputCapacity: 400 })?.piecesPerBag).toBe(20);
    expect(packagingRuleFor({ bottleType: "0.3 ဖြူ", outputCapacity: 400 })?.weightLb).toBe(1.15);
    expect(calculatePackagingBags([{ bottleType: "0.3 ဖြူ", outputCapacity: 400, outputQuantity: 1 }]).groups[0].cards).toBe(1);
  });
  it("maps the 1-liter blue S+S 100-card to a 38×40 bag", () => {
    expect(packagingRuleFor({ bottleType: "1 လီတာ ပြာ (S+S)", outputCapacity: 100 })?.bagSize).toBe("38×40");
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

  it("converts production bag groups into the configured packaging-piece count and weight", () => {
    const result = calculatePackagingBags([{ bottleType: "0.3 ဖြူ", outputCapacity: 400, outputQuantity: 3 }]);
    expect(result.totalPackagingPieces).toBe(60);
    expect(result.totalPackagingWeightLb).toBeCloseTo(3.45);
    expect(result.groups[0].packagingPieces).toBe(60);
  });

  it("converts one 100-pound sala sack into complete packs and pieces", () => {
    expect(packagingPiecesFromSacks("31×25", 1)).toMatchObject({ packs: 51, pieces: 2550 });
    expect(packagingPiecesFromSacks("38×58", 1)).toMatchObject({ packs: 86, pieces: 1720 });
    expect(packagingSacksFromPieces("31×25", 2550)).toMatchObject({ sacks: 1, remainderPieces: 0 });
  });
});
