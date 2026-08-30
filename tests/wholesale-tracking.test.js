import { describe, expect, it } from "vitest";
import { amountExceedsWholesaleThreshold, getWholesaleTracking, WHOLESALE_THRESHOLD_KS } from "../src/lib/wholesale-tracking";

describe("Wholesale threshold tracking", () => {
  it("tracks only amounts strictly above 100,000 Ks", () => {
    expect(WHOLESALE_THRESHOLD_KS).toBe(100000);
    expect(amountExceedsWholesaleThreshold(100000)).toBe(false);
    expect(amountExceedsWholesaleThreshold(100001)).toBe(true);
    expect(amountExceedsWholesaleThreshold("250000")).toBe(true);
    expect(amountExceedsWholesaleThreshold("not-a-number")).toBe(false);
  });

  it("returns a non-mutating tracking record", () => {
    expect(getWholesaleTracking(250000)).toEqual({
      thresholdKs: 100000,
      amount: 250000,
      exceedsThreshold: true,
      classification: "WHOLESALE_THRESHOLD_MATCH",
      rule: "amount > 100000 Ks",
    });
    expect(getWholesaleTracking(100000).exceedsThreshold).toBe(false);
  });
});
