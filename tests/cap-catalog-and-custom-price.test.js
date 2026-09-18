import { describe, expect, it } from "vitest";
import { CAP_ITEMS, buildCatalog } from "@/lib/production-catalog";
import fs from "node:fs";

const pricePage = fs.readFileSync("src/app/price-settings/page.js", "utf8");
const priceRoute = fs.readFileSync("src/app/api/price-settings/route.js", "utf8");
const customCatalog = fs.readFileSync("src/lib/custom-catalog.js", "utf8");

describe("new cap catalog", () => {
  it("contains all four requested cap products", () => {
    expect(CAP_ITEMS).toEqual(expect.arrayContaining([
      expect.objectContaining({ productKey: "CAP_20L_BACK", productName: "အဖုံး - 20 လီတာ အဖုံး (အနောက်)" }),
      expect.objectContaining({ productKey: "CAP_20L_CLEAR", productName: "အဖုံး - 20 လီတာ အဖုံး (အကြည်)" }),
      expect.objectContaining({ productKey: "CAP_PRESS_FLIP", productName: "အဖုံး - နှိပ်ဂေါက်" }),
      expect.objectContaining({ productKey: "CAP_TWIST_FLIP", productName: "အဖုံး - လှည့်ဂေါက်" }),
    ]));
    expect(buildCatalog().filter((item) => ["CAP_20L_BACK", "CAP_20L_CLEAR", "CAP_PRESS_FLIP", "CAP_TWIST_FLIP"].includes(item.productKey))).toHaveLength(4);
  });
});

describe("custom Price Settings catalog", () => {
  it("provides add controls and persists catalog rows through the API", () => {
    expect(pricePage).toContain('addCatalogEntry(event, "addCategory")');
    expect(pricePage).toContain('addCatalogEntry(event, "addItem")');
    expect(priceRoute).toContain('action === "addCategory" || action === "addItem"');
    expect(priceRoute).toContain('scope: action === "addCategory" ? "CUSTOM_CATEGORY" : "CUSTOM_ITEM"');
    expect(customCatalog).toContain("loadCatalogWithCustomItems");
  });
});
