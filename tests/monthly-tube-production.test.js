import { describe, expect, it } from "vitest";
import { createTypeSummaries } from "@/app/api/monthly-tube-production/route";

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
});
