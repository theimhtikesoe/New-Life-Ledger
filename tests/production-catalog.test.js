import { describe, expect, it } from "vitest";
import { BOTTLE_ITEMS, getBottleGroup, getBottleUnit } from "@/lib/production-catalog";

describe("Production bottle catalog", () => {
  it("includes the ဒိန်သေး (S+S) 250 ဆံ့ card in the dairy group", () => {
    const item = BOTTLE_ITEMS.find(({ type }) => type === "ဒိန်သေး (S+S)");
    expect(item).toEqual({ type: "ဒိန်သေး (S+S)", capacities: [250] });
    expect(getBottleGroup("ဒိန်သေး (S+S)")).toBe("special");
  });

  it("includes the ဒိန်ကြီး (S+S) 200 ဆံ့ card in the dairy group", () => {
    const item = BOTTLE_ITEMS.find(({ type }) => type === "ဒိန်ကြီး (S+S)");
    expect(item).toEqual({ type: "ဒိန်ကြီး (S+S)", capacities: [200] });
    expect(getBottleGroup("ဒိန်ကြီး (S+S)")).toBe("special");
  });

  it("includes the requested 45 ကျပ်သား and new bottle cards in their groups", () => {
    expect(BOTTLE_ITEMS).toContainEqual({ type: "45 ကျပ်သား", capacities: [200] });
    expect(getBottleGroup("45 ကျပ်သား")).toBe("45");
    expect(BOTTLE_ITEMS).toContainEqual({ type: "1 လီတာ အဝိုင်း", capacities: [100] });
    expect(getBottleGroup("1 လီတာ အဝိုင်း")).toBe("liter");
    expect(BOTTLE_ITEMS).toContainEqual({ type: "8 ဒေါင့် ဖြူ", capacities: [100, 250] });
    expect(BOTTLE_ITEMS).toContainEqual({ type: "8 ဒေါင့် (S+S)", capacities: [100, 250, 500] });
    expect(getBottleGroup("8 ဒေါင့် ဖြူ")).toBe("08-corner");
    expect(getBottleGroup("8 ဒေါင့် (S+S)")).toBe("08-corner");
    expect(getBottleUnit("8 ဒေါင့် ဖြူ")).toBe("ထုပ်");
    expect(getBottleUnit("ဒိန်သေး (S+S)")).toBe("ထုပ်");
    expect(getBottleUnit("0.3 ဖြူ")).toBe("ကဒ်");
  });
});
