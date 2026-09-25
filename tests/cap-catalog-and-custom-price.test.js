import { describe, expect, it } from "vitest";
import { CAP_ITEMS, GLUE_GROUP, GLUE_ITEMS, PACKAGING_BAG_GROUP, PACKAGING_BAG_ITEMS, buildCatalog } from "@/lib/production-catalog";
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

  it("includes all packaging bag sizes as priceable per-piece items", () => {
    expect(PACKAGING_BAG_GROUP.key).toBe("PACKAGING_BAG");
    expect(PACKAGING_BAG_ITEMS).toHaveLength(7);
    expect(PACKAGING_BAG_ITEMS.find((item) => item.productName === "အိတ်ခွံ 31×25")).toMatchObject({ piecesPerPack: 50, weightLb: 1.96, packsPerSack: 51, piecesPerSack: 2550 });
    expect(buildCatalog().filter((item) => item.categoryKey === "PACKAGING_BAG")).toHaveLength(7);
  });

  it("includes a glue seed item for kg and sack pricing", () => {
    expect(GLUE_GROUP).toMatchObject({ key: "GLUE", productType: "glue-seed" });
    expect(GLUE_ITEMS).toEqual([expect.objectContaining({ productKey: "GLUE_SEED", productName: "ကော်စေ့", unitLabel: "kg" })]);
    expect(buildCatalog().filter((item) => item.categoryKey === "GLUE")).toHaveLength(1);
  });
});
