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
    expect(page).toContain("Date ဖြင့်ကြည့်ရန်");
    expect(route).toContain('searchParams.get("type")');
    expect(route).toContain("validLimit");
    expect(route).toContain("take: validLimit");
    expect(route).toContain("loadDerivedFactoryStockMovements");
    expect(route).toContain("movements");
  });
});
