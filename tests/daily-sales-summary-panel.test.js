import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/components/DailySalesSummaryPanel.jsx"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("DailySalesSummaryPanel", () => {
  it("keeps one combined cash total instead of duplicate retail/wholesale cash cards", () => {
    expect(source).toContain("တစ်နေ့တာ ငွေသား");
    expect(source).toContain("လက်လီငွေသား + လက်ကားငွေသား");
    expect(source).not.toContain(">လက်လီ ငွေသား</p>");
    expect(source).not.toContain(">လက်ကား ငွေသား</p>");
  });

  it("auto-saves existing CashSale values and edited daily inputs", () => {
    expect(source).toContain('setIsEditing(body.data.selectedDay?.source === "CASH_SALE")');
    expect(source).toContain("window.setTimeout(() => { saveDaily(); }, 900)");
    expect(source).toContain('body: JSON.stringify({ date, ...values })');
    expect(source).toContain('body: JSON.stringify({ action: "opening", month: date.slice(0, 7), selectedDate: date, ...openingDraft })');
  });

  it("keeps the Daily Sales card above Activity History in a responsive grid", () => {
    expect(dashboardSource).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4");
    expect(dashboardSource.indexOf("<DailySalesSummaryPanel />")).toBeLessThan(dashboardSource.indexOf('href=\"/activity\"'));
  });
});
