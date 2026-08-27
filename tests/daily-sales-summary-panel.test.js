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
    expect(source).toContain('setSaveNotice("နေ့စဉ်စာရင်း သိမ်းပြီးပါပြီ။")');
    expect(source).toContain('setIsEditing(true);\n      setError(saveError.message || "နေ့စဉ်စာရင်း သိမ်း၍ မရပါ။ ပြန်စမ်းပါ။")');
  });

  it("keeps the Daily Sales card above Activity History in a responsive grid", () => {
    expect(dashboardSource).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4");
    expect(dashboardSource.indexOf("<DailySalesSummaryPanel />")).toBeLessThan(dashboardSource.indexOf('href=\"/activity\"'));
  });

  it("uses the checked August notebook opening prefill and mobile-safe actions", () => {
    expect(source).toContain('amount: "246593950"');
    expect(source).toContain('asOfDate: "2026-08-26"');
    expect(source).toContain("max-h-[calc(100dvh-1rem)]");
    expect(source).toContain("flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap");
    expect(source).toContain("w-full rounded-lg bg-indigo-600");
  });

  it("keeps the combined cash output card aligned with the output grid", () => {
    expect(source).toContain('<div className="mt-4 grid gap-2 sm:grid-cols-2">');
    expect(source).not.toContain('max-w-sm rounded-xl border border-rose-200 bg-rose-50 p-3.5');
  });
});
