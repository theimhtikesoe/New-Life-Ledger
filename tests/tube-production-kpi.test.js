import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, "src/components/Dashboard.jsx"), "utf8");
const detail = fs.readFileSync(path.join(root, "src/components/TubeProductionHistoryPage.jsx"), "utf8");
const route = fs.readFileSync(path.join(root, "src/app/tube-production-history/page.js"), "utf8");
const layout = fs.readFileSync(path.join(root, "src/app/layout-client.jsx"), "utf8");

describe("daily Tube production KPI", () => {
  it("aggregates Tube rows separately and links to the detail page", () => {
    expect(dashboard).toContain('row.category === "tube"');
    expect(dashboard).toContain("tubeProductionSummary.totalPieces");
    expect(dashboard).toContain("/tube-production-history?date=");
    expect(dashboard).toContain('href="/tube-stock"');
    expect(dashboard).toContain("ထုတ်လုပ်ပြီးသော Tube");
    expect(dashboard).toContain("Tube ထွက်ရှိမှု");
  });

  it("provides a date-filtered detail page with Tube metrics", () => {
    expect(detail).toContain("/api/production-reports?date=");
    expect(detail).toContain('row.category === "tube"');
    expect(detail).toContain("tubeMetrics");
    expect(detail).toContain("သုံးကော်စေ့");
    expect(detail).toContain("ကော်ပျက်");
    expect(route).toContain("TubeProductionHistoryPage");
    expect(layout).toContain("'/tube-production-history': 'Tube ထွက်ရှိမှု အသေးစိတ်'");
  });

  it("groups Tube additions by name/capacity and keeps weighted materials separate", () => {
    expect(detail).toContain("Tube လက်ကျန်ထဲ ပေါင်းမည့် ထုတ်လုပ်မှုအကျဉ်းချုပ်");
    expect(detail).toContain("const tubeSummaries = useMemo");
    expect(detail).toContain("အိတ်/pcs သီးခြားစီ");
    expect(detail).toContain("အလေးချိန်ဖြင့် သီးခြားမှတ်တမ်းများ");
    expect(detail).toContain("သီးခြားသယ်ဆောင်/နောက်ပိုင်းလက်ကျန်တွက်ရန်");
    expect(detail).toContain("materialTotals.usedGlueKg");
    expect(detail).toContain("materialTotals.tubeDamageKg");
  });
});
