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

  it("shows calculated values as a non-destructive Preview and saves only explicitly", () => {
    expect(source).toContain('setDraft(toDraft(body.data.autoPreview || body.data.selectedDay))');
    expect(source).not.toContain('setIsEditing(body.data.selectedDay?.source === "CASH_SALE")');
    expect(source).not.toContain("window.setTimeout(() => { saveDaily(); }, 900)");
    expect(source).toContain('Auto Preview (မသိမ်းရသေး)');
    expect(source).toContain('calculationMode: hasManualDifference ? "MANUAL" : "AUTO"');
    expect(source).toContain('adjustmentReason: hasManualDifference ?');
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

  it("keeps six summary cards in an even two-column grid with centered monthly opening", () => {
    const outputStart = source.indexOf('<div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 sm:items-stretch">');
    const outputEnd = source.indexOf('<div className="mt-4 flex flex-col gap-3', outputStart);
    const output = source.slice(outputStart, outputEnd);
    const inputCards = output.indexOf("{[INPUT_FIELDS[0], INPUT_FIELDS[2], INPUT_FIELDS[1], INPUT_FIELDS[3]].map");
    const dailyTotalCard = output.indexOf("တစ်နေ့တာ လက်လီ + လက်ကား");
    const cashTotalCard = output.indexOf("တစ်နေ့တာ ငွေသား");
    const monthlyOpeningCard = output.indexOf('col-span-2 flex h-full w-full flex-col justify-self-center');

    expect(outputStart).toBeGreaterThan(-1);
    expect(output).toContain("grid-cols-2 gap-2 sm:gap-3");
    expect(inputCards).toBeGreaterThan(-1);
    expect(dailyTotalCard).toBeGreaterThan(inputCards);
    expect(cashTotalCard).toBeGreaterThan(dailyTotalCard);
    expect(monthlyOpeningCard).toBeGreaterThan(cashTotalCard);
    expect(output).toContain("လစဉ်စုစုပေါင်း / နောက်နေ့ Opening");
    expect(output).not.toContain("max-w-sm rounded-xl border");
    expect(source).toContain("နေ့စဉ်ရောင်းရငွေ / နောက်နေ့ Opening ဇယား");
    expect(source).toContain("အဲဒီနေ့အဆုံး / နောက်နေ့ Opening");
  });
});
