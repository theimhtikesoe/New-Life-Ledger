import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const route = fs.readFileSync(path.join(root, "src/app/api/monthly-bottle-sales/route.js"), "utf8");
const page = fs.readFileSync(path.join(root, "src/app/monthly-bottle-sales/page.js"), "utf8");
const dailyPage = fs.readFileSync(path.join(root, "src/app/daily-bottle-sales/page.js"), "utf8");
const permissions = fs.readFileSync(path.join(root, "src/lib/user-permissions.js"), "utf8");

describe("monthly bottle sales report", () => {
  it("uses Myanmar month boundaries and the shared no-double-counting summary", () => {
    expect(route).toContain("monthRange(month)");
    expect(route).toContain("getMyanmarDayRange(first).start");
    expect(route).toContain("getMyanmarDayRange(next).start");
    expect(route).toContain("buildDailyBottleSalesSummary");
    expect(route).toContain("creditBottleSales.totalBottles");
    expect(route).toContain("daily");
    expect(route).toContain("enrichTubeTypes");
    expect(route).toContain("prisma.priceSetting.findMany");
  });

  it("provides a headed month page with CSV export and all requested breakdowns", () => {
    expect(page).toContain("တစ်လစာ ဗူးရောင်းစာရင်း");
    expect(page).toContain('type="month"');
    expect(page).toContain("CSV ပြန်ထုတ်ရန်");
    expect(page).toContain("ရက်စွဲအလိုက် စုစုပေါင်း");
    expect(page).toContain("Item အလိုက် စုစုပေါင်း");
    expect(page).toContain("Customer အလိုက် စုစုပေါင်း");
    expect(page).toContain("Tube အလိုက် စုစုပေါင်းဗူး");
    expect(page).toContain("13g / 16g / 24g Tube");
    expect(page).toContain("အဖြူ / အပြာ");
    expect(page).toContain("monthly-bottle-sales-${month}.csv");
  });

  it("links the daily report to the matching month", () => {
    expect(dailyPage).toContain("/monthly-bottle-sales?month=");
    expect(dailyPage).toContain("တစ်လစာ ကြည့်ရန်");
  });

  it("registers the page in the permission system", () => {
    expect(permissions).toContain('path: "/monthly-bottle-sales"');
    expect(permissions).toContain('actorName === "ဆောင်းဦး"');
  });
});
