import { describe, expect, it } from "vitest";
import { getPreviousMyanmarDayRange, getPreviousMyanmarDayRanges } from "@/lib/myanmar-time";

describe("Myanmar report date ranges", () => {
  const now = new Date("2026-08-27T02:30:00.000Z");

  it("selects the previous Myanmar calendar day", () => {
    expect(getPreviousMyanmarDayRange(now).dateLabel).toBe("2026-08-26");
  });

  it("returns bounded catch-up dates oldest-first", () => {
    expect(getPreviousMyanmarDayRanges(now, 3).map((range) => range.dateLabel)).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
    ]);
    expect(getPreviousMyanmarDayRanges(now, 99)).toHaveLength(7);
  });
});
