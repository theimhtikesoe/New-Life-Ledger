import { describe, expect, it } from "vitest";
import { TUBE_WEIGHT_REFERENCE, TUBE_WEIGHT_NOTE } from "../src/lib/tube-weight-reference.js";

describe("Tube weight reference", () => {
  it("keeps the 13g and 24g sack assumptions and calculates net Tube weight", () => {
    expect(TUBE_WEIGHT_REFERENCE).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "13g", gramsPerTube: 13, filledSackKg: 8.76, emptySackKg: 0.62, netTubeKg: 8.14, estimatedPieces: 626 }),
      expect.objectContaining({ id: "24g", gramsPerTube: 24, filledSackKg: 10.36, emptySackKg: 0.62, netTubeKg: 9.74, estimatedPieces: 406 }),
    ]));
    expect(TUBE_WEIGHT_NOTE).toContain("ခြင်းအလွတ် 0.62 kg");
  });
});
