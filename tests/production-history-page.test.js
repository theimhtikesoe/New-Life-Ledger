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
  });
});
