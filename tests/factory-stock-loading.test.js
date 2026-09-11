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
    expect(dashboardSource).toContain("const hasKpiSnapshot = Boolean(dashboardKpi);");
    expect(dashboardSource).toContain("const bottleSalesLoading = (dashboardKpiLoading && !dashboardKpi) || kpiDateLoading;");
    expect(dashboardSource).toContain("productionLoading || kpiDateLoading");
    expect(dashboardSource).toContain("dashboardKpiLoading || !dashboardKpi");
  });

  it("derives stock from existing source records when the movement ledger is empty", () => {
    expect(factoryHelperSource).toContain("export async function loadDerivedFactoryStockMovements");
    expect(factoryHelperSource).toContain("export async function loadCanonicalFactoryStockMovements");
    expect(factoryRouteSource).toContain("loadCanonicalFactoryStockMovements");
    expect(dashboardRouteSource).toContain("loadCanonicalFactoryStockMovements");
    expect(dashboardRouteSource).toContain("factoryTubePieces");
    expect(dashboardRouteSource).toContain('movement.stockType === "TUBE"');
    expect(dashboardSource).toContain("စက်ရုံ Tube လက်ကျန်");
    expect(factoryRouteSource).toContain("buildCatalog().filter((entry) => entry.productType === \"bottle\")");
    expect(factoryRouteSource).toContain("Factory Stock is an Item-level inventory view");
  });

  it("shows the planned stock fields and status in the page table", () => {
    expect(factoryPageSource).toContain("စာရင်းညှိ");
    expect(factoryPageSource).toContain("အခြေအနေ");
    expect(factoryPageSource).toContain("stockStatus");
    expect(factoryPageSource).toContain("ထုတ်လုပ်ဝင်");
    expect(factoryPageSource).not.toContain("FACTORY INVENTORY");
    expect(factoryPageSource).toContain('role="dialog"');
    expect(factoryPageSource).toContain("အသေးစိတ်မှတ်တမ်း");
  });

  it("keeps cap stock guidance visible and uses a popup for details", () => {
    const capPageSource = fs.readFileSync(path.join(root, "src/app/cap-stock/page.js"), "utf8");
    expect(capPageSource).toContain("အဖုံးအရောင်အလိုက် စက်ရုံလက်ကျန်");
    expect(capPageSource).toContain("ဗူးရောင်းတိုင်း ပုံမှန်အဖုံးနှင့် အပိုအဖုံးကို အရောင်အလိုက် အလိုအလျောက်နုတ်တွက်ထားသည်။");
    expect(capPageSource).toContain('role="dialog"');
    expect(capPageSource).toContain('aria-labelledby="cap-stock-detail-title"');
    expect(capPageSource).toContain("max-h-[65dvh]");
    expect(dashboardSource).toContain("factoryCapPieces.toLocaleString()} အိတ်");
  });
});
