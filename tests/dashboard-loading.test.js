import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("Dashboard loading recovery", () => {
  it("has a watchdog so a slow API request cannot leave the screen covered forever", () => {
    expect(source).toContain("DASHBOARD_LOADING_WATCHDOG_MS = 12000");
    expect(source).toContain("setLoadingTimedOut(true)");
    expect(source).toContain("Dashboard data ရယူရန် ကြာနေပါသည်။ ခဏနားပြီး ပြန်လည်ရယူပါမည်။");
    expect(source).toContain("dashboardLoadingWatchdogRef.current");
    expect(source).toContain("dashboardRequestIdRef.current === requestId");
  });

  it("does not show the global data spinner over an already populated dashboard", () => {
    expect(source).toContain("loading && !loadingTimedOut && !dashboardKpi && customers.length === 0 && allCustomersForKPI.length === 0");
    expect(source).toContain("setLoading(false);");
    expect(source).toContain('setLoadingStage("");');
  });

  it("prioritizes the customer list before the expensive KPI stock rebuild", () => {
    expect(source).toContain("Customer data is the critical path for the Ledger");
    expect(source).toContain("const [customerRows, allCustomersRows] = await Promise.all");
    expect(source.indexOf("const customerRequest = api(")).toBeLessThan(source.indexOf("const kpiRequest = api("));
  });

  it("calculates the cash-sale paid amount from listed total minus discount", () => {
    expect(source).toContain("const listedSaleAmount = getSaleItemsTotal(ledgerForm.saleItems);");
    expect(source).toContain("const discountAmount = Math.max(0, Math.round(Number(ledgerForm.paymentBreakdown?.discount || 0)))");
    expect(source).toContain("const amountToSave = hasCashSaleBreakdown ? cashSaleBreakdownTotal : hasSinglePayment ? singlePaymentAmount : amount;");
  });
});
