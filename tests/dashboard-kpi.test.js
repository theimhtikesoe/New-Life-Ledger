import fs from "node:fs";
import path from "node:path";
import { vi, describe, it, expect } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  customerAggregate: vi.fn(),
  ledgerAggregate: vi.fn(),
  ledgerFindMany: vi.fn(),
  cashSaleGroupBy: vi.fn(),
  cashSaleFindMany: vi.fn(),
  dashboardKpiFindUnique: vi.fn(),
  dashboardKpiUpsert: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  ensureDatabase: mocks.ensureDatabase,
  databaseErrorResponse: vi.fn((error) => ({ error: error?.message || "Database error" })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    customer: { aggregate: mocks.customerAggregate },
    ledger: { aggregate: mocks.ledgerAggregate, findMany: mocks.ledgerFindMany },
    cashSale: { groupBy: mocks.cashSaleGroupBy, findMany: mocks.cashSaleFindMany },
    dashboardKpiSnapshot: { findUnique: mocks.dashboardKpiFindUnique, upsert: mocks.dashboardKpiUpsert },
  },
}));
vi.mock("@/lib/myanmar-time", () => ({
  getMyanmarDayRange: vi.fn(() => ({
    start: new Date("2026-08-26T17:30:00.000Z"),
    end: new Date("2026-08-27T17:30:00.000Z"),
    dateLabel: "2026-08-27",
  })),
}));

import { GET } from "@/app/api/dashboard-kpi/route";

const dashboardSource = fs.readFileSync(path.join(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
const transactionRouteSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/customers/[id]/transactions/route.js"), "utf8");

describe("Dashboard KPI aggregate route", () => {
  it("keeps bottle and cap sale forms for debt/cash sales only", () => {
    expect(dashboardSource).toContain('ledgerForm.type !== "DEBIT" ? <>');
    expect(dashboardSource).toContain('type: "DEBIT", saleItems: []');
    expect(transactionRouteSource).toContain('type === "CREDIT" && Array.isArray(body.saleItems)');
  });

  it("offers a target credit ledger when recording a payment", () => {
    expect(dashboardSource).toContain('id="payment-target-ledger"');
    expect(dashboardSource).toContain("paymentTargetLedgers");
    expect(dashboardSource).toContain("__SETTLES_CREDIT_LEDGER__:");
    expect(dashboardSource).toContain("ငွေချေမည့် အကြွေးအဟောင်း ရွေးပါ");
    expect(dashboardSource).toContain("PREPAYMENT_OPTION");
    expect(dashboardSource).toContain("ငွေကြိုချေ (အကြွေးမရှိ)");
  });

  it("uses the customer total balance for payment validation, not a selected credit remainder", () => {
    expect(dashboardSource).toContain("availableCustomerBalance > 0 && amount + ledgerDiscountAmount > availableCustomerBalance");
    expect(dashboardSource).toContain("availableCustomerBalance");
    expect(dashboardSource).toContain('ledgerForm.type === "DEBIT"\n                                  ? (ledgerForm.manualAmount ?? "")');
  });

  it("hydrates linked settled bottle items for the paid-bottle KPI", () => {
    const routeSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/dashboard-kpi/route.js"), "utf8");
    expect(routeSource).toContain('import { hydrateSettledBottleSaleItems } from "@/lib/bottle-sales-ledger";');
    expect(routeSource).toContain("const settledLedgers = await hydrateSettledBottleSaleItems");
    expect(routeSource).toContain("buildDailyBottleSalesSummary");
  });

  it("matches Cap Stock Net Stock Change for the factory cap KPI", () => {
    const routeSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/dashboard-kpi/route.js"), "utf8");
    expect(routeSource).toContain('item.stockType === "CAP" && Number(item.capacity || 0) > 0');
    expect(routeSource).toContain("loadCanonicalFactoryStockMovements");
    expect(routeSource).not.toContain('by: ["stockType", "capacity", "movementType"]');
  });

  it("uses the shared daily bottle sales summary for Dashboard and detail pages", () => {
    const routeSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/dashboard-kpi/route.js"), "utf8");
    const dailyRouteSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/daily-bottle-sales/route.js"), "utf8");
    expect(routeSource).toContain('buildDailyBottleSalesSummary');
    expect(dailyRouteSource).toContain('buildDailyBottleSalesSummary');
    expect(routeSource).not.toContain('const totalBottleSales = { ...bottleSales };');
  });

  it("shows the automatic amount card for cash sales", () => {
    expect(dashboardSource).toContain("အလိုအလျောက်တွက်ထားသော ပမာဏ");
    expect(dashboardSource).toContain("getSaleItemsTotal(ledgerForm.saleItems) || computedSaleAmount || ledgerForm.amount || 0");
  });

  it("provides an isolated date selector for date-sensitive KPI cards", () => {
    expect(dashboardSource).toContain('id="dashboard-kpi-date"');
    expect(dashboardSource).toContain('type="date"');
    expect(dashboardSource).toContain("{!isLedgerView ? (");
    expect(dashboardSource).toContain('api(`/api/dashboard-kpi?date=${encodeURIComponent(selectedKpiDate)}${forceRefresh ? "&refresh=1" : ""}`');
    expect(dashboardSource).toContain('new-life-ledger:cap-stock-updated-at');
    expect(dashboardSource).toContain('new-life-ledger:cap-stock-updated');
    expect(dashboardSource).toContain("DASHBOARD_LOADING_WATCHDOG_MS = 12000");
    expect(dashboardSource).toContain("category=bottle");
    expect(dashboardSource).toContain('const bottleRows = rows.filter((row) => row.category !== "tube");');
    expect(dashboardSource).toContain("The write has already succeeded at this point");
    expect(dashboardSource).toContain("const selectedKpiIsToday = selectedKpiDate === currentMyanmarDate;");
    expect(dashboardSource).toContain("onClick={() => setShowTodayPaymentsModal(true)}");
    expect(dashboardSource).toContain("disabled={!selectedKpiIsToday}");
    expect(dashboardSource).toContain('href={`/production-history?date=${encodeURIComponent(selectedKpiDate)}`}');
    expect(dashboardSource).toContain("dashboard-kpi-grid grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4");
    expect(dashboardSource).toContain("`${tubeProductionSummary.totalPacks.toLocaleString()} အိတ်`");
    expect(dashboardSource).toContain("`${tubeProductionSummary.totalPieces.toLocaleString()} pcs · အမျိုးအစား ${tubeProductionSummary.rows.length} မျိုး`");
    expect(dashboardSource).toContain("`${factoryTubePacks.toLocaleString()} အိတ်`");
    expect(dashboardSource).toContain("`${factoryTubePieces.toLocaleString()} pcs · ထုတ်လုပ်ဝင်ပြီးနောက် ကျန်သော Tube`");
    expect(dashboardSource).not.toContain("`${tubeProductionSummary.totalPieces.toLocaleString()} လုံး`");
    expect(dashboardSource).not.toContain("`${factoryTubePieces.toLocaleString()} လုံး`");
    expect(dashboardSource).toContain('Number(displayedTotalBalance) < 0 ? "text-green-700" : "text-rose-700"');
  });

  it("shows daily tube glue usage and remaining stock in one Dashboard KPI", () => {
    expect(dashboardSource).toContain("const tubeMaterialSummary = useMemo");
    expect(dashboardSource).toContain("metrics.usedGlueKg");
    expect(dashboardSource).toContain("metrics.usedGlueBags");
    expect(dashboardSource).toContain("metrics.remainingGlueKg");
    expect(dashboardSource).toContain("metrics.remainingGlueBags");
    expect(dashboardSource).toContain("ယနေ့ ကော်စေ့ သုံး/ကျန်");
    expect(dashboardSource).toContain("tubeMaterialSummary.usedGlueKg.toLocaleString()");
    expect(dashboardSource).toContain("tubeMaterialSummary.remainingGlueBags.toLocaleString()");
    expect(dashboardSource).toContain('href={`/tube-production-history?date=${encodeURIComponent(selectedKpiDate)}`}');
  });

  it("shows daily glue usage for the requested users but not Zway Zway", () => {
    expect(dashboardSource).toContain('["ဖြိုးကို", "ဖေဖေ/မေမေ", "ပုံ့ပုံ့", "Rhyzoe"].includes(dashboardActorName)');
    expect(dashboardSource).toContain("{showDailyGlueUsageKpi ? <Link");
    const zwayBranch = dashboardSource.split('{dashboardActorName === "ဇွဲဇွဲ" ? <>')[1].split('</> : <>')[0];
    expect(zwayBranch).not.toContain("စက်ရုံ ကော်စေ့ လက်ကျန်");
  });

  it("uses the same packaging-piece details and balance KPI across dashboard branches", () => {
    expect(dashboardSource).not.toContain("packagingBagSummary.totalBags.toLocaleString()} အိတ်");
    expect(dashboardSource).toContain("packagingBagSummary.totalPackagingPieces.toLocaleString()} လုံး");
    expect(dashboardSource).toContain("packagingBagSummary.totalPackagingWeightLb.toLocaleString()} ပေါင်");
    expect(dashboardSource).toContain("factoryPackagingBagPieces.toLocaleString()} လုံး");
    expect(dashboardSource).toContain("ထုပ်ပိုး အိတ်ခွံ လက်ကျန်");
  });

  it("keeps packaging daily KPI out of the cap and production-only dashboards", () => {
    const capBranch = dashboardSource.split("{isCapStockDashboard ? (")[1].split(") : isProductionDashboard ? (")[0];
    const productionBranch = dashboardSource.split(") : isProductionDashboard ? (")[1].split("</section>\n        ) : null;")[0];
    expect(capBranch).not.toContain("ယနေ့ ထုပ်ပိုး အိတ်ခွံ");
    expect(productionBranch).not.toContain("ထုပ်ပိုး အိတ်ခွံ");
    expect(capBranch).toContain("ထုပ်ပိုး အိတ်ခွံ လက်ကျန်");
  });

  it("returns KPI totals without loading full customer or daily-summary rows", async () => {
    mocks.ensureDatabase.mockResolvedValue(undefined);
    mocks.dashboardKpiFindUnique.mockResolvedValue(null);
    mocks.dashboardKpiUpsert.mockResolvedValue({});
    mocks.customerAggregate.mockResolvedValue({ _count: { _all: 12 }, _sum: { current_balance: 3400000 } });
    mocks.ledgerAggregate.mockResolvedValue({ _count: { _all: 4 }, _sum: { amount: 800000 } });
    mocks.ledgerFindMany.mockImplementation(({ where } = {}) => Promise.resolve(
      where?.type === "CREDIT"
        ? [{ type: "CREDIT", amount: 20000, saleItems: [{ productKey: "water-1l", productName: "ရေသန့်", capacity: 1, bottleCount: 12, totalAmount: 24000 }] }]
        : [{ type: "DEBIT", amount: 20000, saleItems: [{ productKey: "water-1l", productName: "ရေသန့်", capacity: 1, bottleCount: 12, totalAmount: 24000 }] }],
    ));
    mocks.cashSaleGroupBy.mockResolvedValue([
      { saleType: "RETAIL", _count: { _all: 2 }, _sum: { amount: 300000 } },
      { saleType: "WHOLESALE", _count: { _all: 1 }, _sum: { amount: 700000 } },
    ]);
    mocks.cashSaleFindMany.mockResolvedValue([
      { amount: 14000, saleItems: [{ productKey: "water-1l", productName: "ရေသန့်", capacity: 1, bottleCount: 8, totalAmount: 16000 }] },
    ]);

    const response = await GET(new Request("http://localhost/api/dashboard-kpi"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      date: "2026-08-27",
      totalCustomers: 12,
      totalBalance: 3400000,
      todayPaidCount: 4,
      todayPaidAmount: 800000,
      count: 3,
      amount: 1000000,
      retailCount: 2,
      retailAmount: 300000,
      wholesaleCount: 1,
      wholesaleAmount: 700000,
      bottleSales: {
        totalBottles: 8,
        totalAmount: 16000,
        totalPaidAmount: 14000,
        items: [{ productKey: "water-1l::1::1", bottleCount: 8, totalAmount: 16000 }],
      },
      paidBottleSales: { totalBottles: 12 },
      cashBottleSales: { totalBottles: 8 },
      totalBottleSales: { totalBottles: 20, totalAmount: 40000, totalPaidAmount: 34000 },
      creditBottleSales: { totalBottles: 12, totalAmount: 24000 },
    });
    expect(mocks.customerAggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
    expect(mocks.ledgerAggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ type: "DEBIT" }) }));
  });

  it("serves a fresh durable snapshot without recomputing stock and ledger aggregates", async () => {
    const payload = { date: "2026-08-27", kpiVersion: 2, totalCustomers: 12, factoryTubePacks: 4 };
    mocks.customerAggregate.mockClear();
    mocks.ledgerAggregate.mockClear();
    mocks.cashSaleGroupBy.mockClear();
    mocks.dashboardKpiUpsert.mockClear();
    mocks.dashboardKpiFindUnique.mockResolvedValue({ payload, generatedAt: new Date() });
    const response = await GET(new Request("http://localhost/api/dashboard-kpi?date=2026-08-27"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ data: payload, cache: "hit" });
    expect(mocks.customerAggregate).not.toHaveBeenCalled();
    expect(mocks.dashboardKpiUpsert).not.toHaveBeenCalled();
  });
});
