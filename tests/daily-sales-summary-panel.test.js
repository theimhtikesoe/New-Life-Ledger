import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/components/DailySalesSummaryPanel.jsx"), "utf8");

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
});
