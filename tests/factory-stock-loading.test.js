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
    expect(factoryRouteSource).toContain("buildCatalog().filter((entry) => entry.productType === \"bottle\" &&");
    expect(factoryRouteSource).toContain("Factory Stock is an Item-level inventory view");
    expect(dashboardSource).toContain("Re-fetch the server-derived KPI immediately");
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
    expect(capPageSource).toContain("Edit");
    expect(capPageSource).toContain("Delete");
    expect(factoryRouteSource).toContain("export async function PATCH(request)");
    expect(factoryRouteSource).toContain("export async function DELETE(request)");
    expect(factoryRouteSource).toContain('sourceType: "CAP_OPENING"');
    expect(capPageSource).toContain("dailyCapAddedPieces");
    expect(capPageSource).toContain("ယနေ့ အသစ်ထည့်သော အဖုံး");
    expect(capPageSource).toContain("border-emerald-300 bg-emerald-50");
  });
});


import { saleMovementRows, aggregateStockMovements } from "../src/lib/factory-stock.js";
describe("cap stock unit accounting", () => {
  it("treats one bottle as one cap and converts 5000 caps to one bag", () => {
    const rows = saleMovementRows([{ id: "sale-1", date: "2026-09-11", saleItems: [{ productType: "bottle", productName: ".3 ဖြူ", productKey: ".3 ဖြူ::100", capacity: 100, bottleCount: 200, cardCount: 2, capNormalCount: 200, capExtraCount: 0, capProductKey: "ပြာ", capProductName: "ပြာ", capLocation: "မန္တလေး", capPackSize: 5000 }] }]);
    const cap = rows.find((row) => row.stockType === "CAP");
    expect(cap).toMatchObject({ productKey: "CAP::မန္တလေး::ပြာ::5000", quantityCards: 0, quantityBottles: -200, capacity: 5000 });
    const summary = aggregateStockMovements([{ ...cap, movementType: "ADJUSTMENT_IN", quantityCards: 1, quantityBottles: 5000 }, cap]);
    expect(summary[0].currentBottles).toBe(4800);
    expect(summary[0].currentCards).toBeCloseTo(0.96);
  });

  it("reconstructs cap pieces from legacy bag-only opening rows", () => {
    const summary = aggregateStockMovements([{
      stockType: "CAP",
      productKey: "CAP::မန္တလေး::ပြာ::5000",
      productName: "မန္တလေး · ပြာ",
      capacity: 5000,
      movementType: "ADJUSTMENT_IN",
      quantityCards: 240,
      quantityBottles: 0,
    }]);
    expect(summary[0]).toMatchObject({ currentCards: 240, currentBottles: 1200000 });
  });

  it("reduces bottle stock for a Ledger sale and restores it when that sale is absent", () => {
    const sale = saleMovementRows([{ id: "ledger-sale-1", date: "2026-09-11", saleItems: [{ productType: "bottle", productName: ".3 ဖြူ", productKey: ".3 ဖြူ::100", capacity: 100, bottleCount: 200, cardCount: 2 }] }]);
    const production = { stockType: "BOTTLE", productKey: ".3 ဖြူ::100", productName: ".3 ဖြူ", capacity: 100, movementType: "PRODUCTION_IN", quantityCards: 10, quantityBottles: 1000 };
    const afterSale = aggregateStockMovements([production, ...sale])[0];
    const afterDeletion = aggregateStockMovements([production])[0];
    expect(afterSale).toMatchObject({ currentCards: 8, currentBottles: 800, soldCards: 2, soldBottles: 200 });
    expect(afterDeletion).toMatchObject({ currentCards: 10, currentBottles: 1000, soldCards: 0, soldBottles: 0 });
  });
});
