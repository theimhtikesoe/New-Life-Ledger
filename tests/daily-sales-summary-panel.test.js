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
    expect(source).toContain('>လအစ Opening</button>');
    expect(source).toContain('aria-expanded={showOpeningForm}');
    expect(source).not.toContain('setShowOpeningForm(true);');
    expect(source).toContain('calculationMode: hasManualDifference ? "MANUAL" : "AUTO"');
    expect(source).toContain('adjustmentReason: hasManualDifference ?');
    expect(source).toContain('body: JSON.stringify({ action: "opening", month: date.slice(0, 7), selectedDate: date, ...openingDraft })');
    expect(source).toContain('setSaveNotice("နေ့စဉ်စာရင်း သိမ်းပြီးပါပြီ။")');
    expect(source).toContain('setIsEditing(true);\n      setError(saveError.message || "နေ့စဉ်စာရင်း သိမ်း၍ မရပါ။ ပြန်စမ်းပါ။")');
  });

  it("keeps the Daily Sales card above Activity History in a responsive grid", () => {
    expect(dashboardSource).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4");
    expect(dashboardSource).toContain("<DailySalesSummaryPanel selectedDate={selectedKpiDate}");
    expect(dashboardSource).toContain('href="/activity"');
  });

  it("uses the checked August notebook opening prefill and mobile-safe actions", () => {
    expect(source).toContain('amount: "246593950"');
    expect(source).toContain('asOfDate: "2026-08-26"');
    expect(source).toContain("max-h-[calc(100dvh-1rem)]");
    expect(source).toContain("flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap");
    expect(source).toContain("w-full rounded-lg bg-indigo-600");
  });

  it("uses the current table Opening value in the green card", () => {
    expect(source).toContain("const currentTableOpening = tableRows.find((row) => dateKey(row.date) === dateKey(date))?.monthlyCumulative;");
    expect(source).toContain("const displayedOpening = currentTableOpening == null ? dailyTotal : currentTableOpening;");
    expect(source).toContain("const tableSummary = historySummary;");
    expect(source).toContain("const [historyLoading, setHistoryLoading] = useState(false);");
    expect(source).toContain("const chronologicalRows = [...tableSummary.rows].sort((a, b) => a.date.localeCompare(b.date));");
    expect(source).toContain("const [historyDate, setHistoryDate] = useState(() => formatMyanmarDateInputValue());");
    expect(source).toContain("Table Date");
    expect(source).toContain("const rowsWithCumulative = chronologicalRows.map((row) => {");
    expect(source).toContain("{formatMoney(displayedOpening)}");
    expect(source).toContain("လအစ Opening နှင့် ယနေ့အထိ လက်လီ/လက်ကား ရောင်းရငွေ စုစုပေါင်း။ ယနေ့အဆုံးတန်ဖိုးသည် နောက်နေ့ Opening ဖြစ်သည်။");
    expect(source).toContain("getPreviousMyanmarDateInputValue(`${targetDate.slice(0, 7)}-01`)");
  });

  it("opens the latest history page when the selected date has no row yet", () => {
    expect(source).toContain("selectedDateIndex >= 0 ? Math.floor(selectedDateIndex / HISTORY_PAGE_SIZE) + 1 : historyPageCount");
    expect(source).toContain("selected date has no row yet");
  });

  it("keeps the history table aligned with the selected top date", () => {
    expect(source).toContain("setHistoryDate(targetDate);");
    expect(source).toContain("setHistoryPage(1);");
  });

  it("keeps six summary cards in an even two-column grid with centered monthly opening", () => {
    const outputStart = source.indexOf('<div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 sm:items-stretch">');
    const outputEnd = source.indexOf('<div className="mt-4 flex flex-col gap-3', outputStart);
    const output = source.slice(outputStart, outputEnd);
    const inputCards = output.indexOf("{[INPUT_FIELDS[0], INPUT_FIELDS[2], INPUT_FIELDS[1], INPUT_FIELDS[3]].map");
    const dailyTotalCard = output.indexOf("ယနေ့ လက်လီ + လက်ကား ရောင်းရငွေ");
    const cashTotalCard = output.indexOf("တစ်နေ့တာ ငွေသား");
    const monthlyOpeningCard = output.indexOf('col-span-2 flex h-full w-full flex-col justify-self-center');

    expect(outputStart).toBeGreaterThan(-1);
    expect(output).toContain("grid-cols-2 gap-2 sm:gap-3");
    expect(inputCards).toBeGreaterThan(-1);
    expect(dailyTotalCard).toBeGreaterThan(inputCards);
    expect(cashTotalCard).toBeGreaterThan(dailyTotalCard);
    expect(monthlyOpeningCard).toBeGreaterThan(cashTotalCard);
    expect(output).toContain("ယနေ့အထိ စုစုပေါင်း / နောက်နေ့ Opening");
    expect(output).not.toContain("max-w-sm rounded-xl border");
    expect(source).toContain("နေ့စဉ်ရောင်းရငွေ / နောက်နေ့ Opening ဇယား");
    expect(source).toContain("ယနေ့အဆုံး စုစုပေါင်း / နောက်နေ့ Opening");
  });
});
