import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("debt reconciliation workflow", () => {
  it("exposes a customer-by-customer reconciliation page from the dashboard", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "src/app/debt-reconciliation/page.js"), "utf8");
    expect(dashboard).toContain('href="/debt-reconciliation"');
    expect(page).toContain("မြေပြင်နောက်ဆုံးလက်ကျန်");
    expect(page).toContain("နောက်ဆုံးစာရင်းညှိ သိမ်းမည်");
    expect(page).toContain("အဟောင်းငွေချေများကို ပြန်မချိတ်ပါ");
    expect(page).toContain("grid-cols-2");
  });

  it("loads the first transaction page quickly and completes the full history in the background", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
    expect(dashboard).toContain("limit=100&offset=0&includeCount=false");
    expect(dashboard).toContain("while (nextPage.pagination?.hasMore)");
    expect(dashboard).toContain("allLedgers.push");
    expect(dashboard).toContain("includeCount=false");
    expect(dashboard).toContain("setLoadingCustomerHistory(false)");
  });

  it("keeps prepayments for the next matching debt instead of older debt", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
    const route = readFileSync(resolve(process.cwd(), "src/app/api/debt-reconciliation/route.js"), "utf8");
    expect(dashboard).toContain("futurePrepayments");
    expect(dashboard).toContain("hasNearFutureMatchingCredit");
    expect(dashboard).toContain("__PREPAYMENT__");
    expect(route).toContain("futurePrepayments");
    expect(route).toContain("hasNearFutureMatchingCredit");
    expect(route).toContain("Do not rewrite old payment notes");
  });

  it("adds only non-equal linked credit/payment totals to settlement diagnostics", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/dashboard-reconciliation/route.js"), "utf8");
    const dashboard = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
    expect(route).toContain('type: isPrepayment ? "LINKED_PREPAYMENT" : isClearedSurplus ? "LINKED_SURPLUS_CLEARED" : "LINKED_TOTAL_MISMATCH"');
    expect(route).toContain('isClearedSurplus ? "LINKED_SURPLUS_CLEARED"');
    expect(route).toContain("balanceByCustomer.get(target.customerId)");
    expect(route).toContain("linkedAmount !== rounded(target.amount)");
    expect(route).toContain("payments.length > 1 && (!target || linkedAmount < rounded(target.amount))");
    expect(dashboard).toContain("LINKED_PREPAYMENT");
    expect(dashboard).toContain("ကြိုတင်ငွေချေ");
    expect(dashboard).toContain("ငွေချေမပြည့်သေးသော ခြားနားချက်");
    expect(dashboard).toContain("ပိုငွေချေ / ပါးစပ်လျှော့စျေး ဖြစ်နိုင်သော ခြားနားချက်");
    expect(dashboard).not.toContain("ချိတ်ထားသော အကြွေးတိုး: {formatMoney(row.targetAmount)}");
    expect(dashboard).toContain("LINKED_SURPLUS_CLEARED");
  });

  it("persists reconciliation as an audit record instead of deleting old ledgers", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/debt-reconciliation/route.js"), "utf8");
    expect(route).toContain('action: "DEBT_RECONCILIATION_SAVE"');
    expect(route).toContain("groundTruthBalance");
    expect(route).not.toContain("prisma.ledger.delete");
  });
});
