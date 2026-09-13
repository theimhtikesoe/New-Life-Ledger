import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root = process.cwd();
const page = fs.readFileSync(path.join(root, "src/components/TubeStockDetailPage.jsx"), "utf8");
const route = fs.readFileSync(path.join(root, "src/app/api/tube-stock/route.js"), "utf8");
describe("Tube stock type detail", () => {
  it("provides a per-type detail action and bounded API query", () => {
    expect(page).toContain("openTypeDetails");
    expect(page).toContain(">ကြည့်</button>");
    expect(page).toContain("tube-type-detail-title");
    expect(page).toContain("PRODUCTION_USE_OUT");
    expect(route).toContain('searchParams.get("type")');
    expect(route).toContain("validLimit");
    expect(route).toContain("take: validLimit");
    expect(route).toContain("loadDerivedFactoryStockMovements");
    expect(route).toContain("movements");
    expect(route).toContain("productionPacks");
    expect(route).toContain("usedPieces");
    expect(route).toContain("currentPieces");
  });

  it("collapses weight details and shows summary KPIs", () => {
    expect(page).toContain("နှိပ်၍ အသေးစိတ်ကြည့်ရန်");
    expect(page).toContain("Tube အမျိုးအစား");
    expect(page).toContain("ထုတ်လုပ်ဝင်");
    expect(page).toContain("သုံးစွဲ");
    expect(page).toContain("လက်ကျန်");
    expect(page).toContain("<details");
  });
});
