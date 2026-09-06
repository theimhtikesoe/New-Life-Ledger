import { describe, expect, it } from "vitest";
import { BOTTLE_ITEMS, getBottleGroup } from "@/lib/production-catalog";

describe("Production bottle catalog", () => {
  it("includes the ဒိန်သေး (S+S) 250 ဆံ့ card in the dairy group", () => {
    const item = BOTTLE_ITEMS.find(({ type }) => type === "ဒိန်သေး (S+S)");
    expect(item).toEqual({ type: "ဒိန်သေး (S+S)", capacities: [250] });
    expect(getBottleGroup("ဒိန်သေး (S+S)")).toBe("special");
  });
});
