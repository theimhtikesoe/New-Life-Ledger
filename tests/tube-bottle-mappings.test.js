import { describe, expect, it } from "vitest";
import { DEFAULT_TUBE_MAPPINGS, TUBE_BY_MACHINE, TUBE_PRODUCT_TYPES, normalizeTubeTypes } from "@/lib/production-catalog";

describe("requested bottle-to-tube mappings", () => {
  it("maps both 25 ကျပ်သား အပြာ capacities to 16g (S+S) only", () => {
    expect(DEFAULT_TUBE_MAPPINGS["25 ကျပ်သား အပြာ::100"]).toBe("16g (S+S)");
    expect(DEFAULT_TUBE_MAPPINGS["25 ကျပ်သား အပြာ::210"]).toBe("16g (S+S)");
    expect(TUBE_PRODUCT_TYPES).toContain("16g (S+S)");
    expect(TUBE_PRODUCT_TYPES).not.toContain("16g B (S+S)");
  });

  it("maps 0.9 ပြာ S+1 and S+S variants to their matching 24g blue tube", () => {
    for (const capacity of [100, 170]) {
      expect(normalizeTubeTypes(DEFAULT_TUBE_MAPPINGS[`0.9 ပြာ (S+1)::${capacity}`])).toEqual(["24g B (S+1)"]);
      expect(normalizeTubeTypes(DEFAULT_TUBE_MAPPINGS[`0.9 ပြာ (S+S)::${capacity}`])).toEqual(["24g B (S+S)"]);
    }
  });

  it("maps 1 လီတာ ပြာ S+1 and S+S variants to their matching 24g blue tube", () => {
    for (const capacity of [100, 160]) {
      expect(normalizeTubeTypes(DEFAULT_TUBE_MAPPINGS[`1 လီတာ ပြာ (S+1)::${capacity}`])).toEqual(["24g B (S+1)"]);
      expect(normalizeTubeTypes(DEFAULT_TUBE_MAPPINGS[`1 လီတာ ပြာ (S+S)::${capacity}`])).toEqual(["24g B (S+S)"]);
    }
  });

  it("offers the requested 16g (S+S) production item on TB1", () => {
    expect(TUBE_BY_MACHINE.TB1).toContainEqual({
      g: "16g",
      color: "S+S",
      pcsPerBag: 2000,
      label: "16g (S+S)",
    });
  });
});
