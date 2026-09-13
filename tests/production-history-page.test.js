import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const dashboardSource = fs.readFileSync(path.join(root, "src/components/Dashboard.jsx"), "utf8");
const pageSource = fs.readFileSync(path.join(root, "src/components/ProductionHistoryPage.jsx"), "utf8");
const routeSource = fs.readFileSync(path.join(root, "src/app/production-history/page.js"), "utf8");
const layoutSource = fs.readFileSync(path.join(root, "src/app/layout-client.jsx"), "utf8");

describe("Production history page", () => {
  it("opens from the dashboard production KPI in a dedicated route", () => {
    expect(dashboardSource).toContain('href={`/production-history?date=${encodeURIComponent(selectedKpiDate)}`}');
    expect(routeSource).toContain("ProductionHistoryPage");
    expect(layoutSource).toContain("'/production-history': 'ထွက်ရှိမှုမှတ်တမ်းများ'");
  });

  it("supports date selection and groups report rows by submission", () => {
    expect(pageSource).toContain("new URLSearchParams(window.location.search).get(\"date\")");
    expect(pageSource).toContain("/api/production-reports?date=");
    expect(pageSource).toContain("row.submissionId || row.id");
    expect(pageSource).toContain("မှတ်တမ်း Date");
    expect(pageSource).toContain("ပူးတွဲဆင်းသူ");
    expect(pageSource).toContain("normalizeWorkerNames");
    expect(pageSource).toContain("current.workers = [...new Set");
    expect(pageSource).toContain("group.workers.map");
  });

  it("provides a book-style bottle product/capacity summary without the deferred print control", () => {
    expect(pageSource).toContain("ဗူးစာအုပ်မှတ်တမ်းအကျဉ်းချုပ်");
    expect(pageSource).toContain("summaries.bottles");
    expect(pageSource).toContain("category=bottle");
    expect(pageSource).not.toContain("summaries.tubes.length");
    expect(pageSource).not.toContain("window.print()");
  });

  it("shows Production-style KPIs with good bottles separated from damage", () => {
    expect(pageSource).toContain('row.category === "bottle" || (!row.category && row.bottleType)');
    expect(pageSource).toContain("ကောင်းမွန်ဗူး");
    expect(pageSource).toContain("ဗူးပျက်");
    expect(pageSource).toContain("Tube ပျက်");
    expect(pageSource).toContain("Tube လက်ကျန်မှ နုတ်ထား");
    expect(pageSource).toContain("grid grid-cols-2 gap-2 sm:grid-cols-4");
    expect(pageSource).toContain("group.tubeDamageQuantity");
    expect(pageSource).toContain("ဗူးပျက်ကို သီးခြားမှတ်တမ်းတင်ပြီး ဗူးလက်ကျန်မှ မနုတ်ပါ");
  });

  it("does not subtract bottle waste from the Dashboard good-output KPI", () => {
    expect(dashboardSource).toContain("goodPieces: totalPieces");
  });
});
