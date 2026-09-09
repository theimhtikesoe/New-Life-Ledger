import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const dashboardSource = fs.readFileSync(path.join(root, "src/components/Dashboard.jsx"), "utf8");
const factoryPageSource = fs.readFileSync(path.join(root, "src/app/factory-stock/page.js"), "utf8");
const factoryRouteSource = fs.readFileSync(path.join(root, "src/app/api/factory-stock/route.js"), "utf8");
const factoryHelperSource = fs.readFileSync(path.join(root, "src/lib/factory-stock.js"), "utf8");
const dashboardRouteSource = fs.readFileSync(path.join(root, "src/app/api/dashboard-kpi/route.js"), "utf8");

describe("factory stock and dashboard loading contract", () => {
  it("does not render an initial production zero before the first request", () => {
    expect(dashboardSource).toContain("const [productionLoading, setProductionLoading] = useState(true);");
    expect(dashboardSource).toContain("const [dashboardKpiLoading, setDashboardKpiLoading] = useState(true);");
    expect(dashboardSource).toContain("productionLoading || kpiDateLoading");
    expect(dashboardSource).toContain("dashboardKpiLoading || !dashboardKpi");
  });

  it("derives stock from existing source records when the movement ledger is empty", () => {
    expect(factoryHelperSource).toContain("export async function loadDerivedFactoryStockMovements");
    expect(factoryRouteSource).toContain('dataSource = "LIVE_DERIVED_FALLBACK"');
    expect(dashboardRouteSource).toContain("loadDerivedFactoryStockMovements");
    expect(dashboardRouteSource).toContain("factoryTubePieces");
    expect(dashboardSource).toContain("စက်ရုံ Tube လက်ကျန်");
  });

  it("shows the planned stock fields and status in the page table", () => {
    expect(factoryPageSource).toContain("စာရင်းညှိ");
    expect(factoryPageSource).toContain("အခြေအနေ");
    expect(factoryPageSource).toContain("stockStatus");
    expect(factoryPageSource).toContain("LIVE_DERIVED_FALLBACK");
    expect(factoryPageSource).toContain('role="dialog"');
    expect(factoryPageSource).toContain("အသေးစိတ်မှတ်တမ်း");
  });
});
