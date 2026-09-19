import { describe, expect, it } from "vitest";
import { createTypeSummaries } from "@/app/api/monthly-tube-production/route";
import { normalizeTubeTypes } from "@/lib/production-catalog";

describe("Monthly Tube production type summaries", () => {
  it("starts with every catalog Tube type at zero", () => {
    const summaries = createTypeSummaries();

    expect(summaries.get("24g W (အဖြူ)::1500")).toEqual({
      tubeType: "24g W (အဖြူ)",
      capacity: 1500,
      packs: 0,
      pieces: 0,
      reports: 0,
    });
    expect(summaries.get("13g (S+S)::2500")).toEqual({
      tubeType: "13g (S+S)",
      capacity: 2500,
      packs: 0,
      pieces: 0,
      reports: 0,
    });
    expect(summaries.size).toBe(9);
  });

  it("normalizes historical W, S+1, and S+S labels to the same nine types", () => {
    expect(normalizeTubeTypes("13g W")).toEqual(["13g W (အဖြူ)"]);
    expect(normalizeTubeTypes("13g S+1")).toEqual(["13g (S+1)"]);
    expect(normalizeTubeTypes("13g S+S")).toEqual(["13g (S+S)"]);
    expect(normalizeTubeTypes("16g B (S+S)")).toEqual(["16g (S+S)"]);
    expect(normalizeTubeTypes("24g W")).toEqual(["24g W (အဖြူ)"]);
  });
});
