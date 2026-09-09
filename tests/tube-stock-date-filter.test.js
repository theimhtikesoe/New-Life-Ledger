import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root = process.cwd();
const page = fs.readFileSync(path.join(root, "src/components/TubeStockDetailPage.jsx"), "utf8");
const route = fs.readFileSync(path.join(root, "src/app/api/tube-stock/route.js"), "utf8");
describe("Tube stock date-filtered history", () => {
  it("has a Date picker and bounded recent history query", () => {
    expect(page).toContain("recentDate");
    expect(page).toContain('type="date"');
    expect(page).toContain("Date ဖြင့်ကြည့်ရန်");
    expect(page).toContain("နောက်ဆုံးမှတ်တမ်း ၃၀ ခု");
    expect(route).toContain('searchParams.get("date")');
    expect(route).toContain("recentRows");
    expect(route).toContain("...(validDate ? { reportDate: validDate } : {})");
    expect(route).toContain("take: 30");
  });
});
