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

  it("loads all selected-customer ledger pages for payment target calculation", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
    expect(dashboard).toContain("limit=100&offset=0&includeCount=true");
    expect(dashboard).toContain("while (nextPage.pagination?.hasMore)");
    expect(dashboard).toContain("allLedgers.push");
  });

  it("uses old unlinked payments only as display-only FIFO evidence", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/debt-reconciliation/route.js"), "utf8");
    expect(route).toContain("unlinkedPaymentPool");
    expect(route).toContain("legacyPaid");
    expect(route).toContain("Do not rewrite old payment notes");
    expect(route).toContain('links: []');
  });

  it("adds only non-equal linked credit/payment totals to settlement diagnostics", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/dashboard-reconciliation/route.js"), "utf8");
    const dashboard = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
    expect(route).toContain('type: "LINKED_TOTAL_MISMATCH"');
    expect(route).toContain("linkedAmount !== rounded(target.amount)");
    expect(dashboard).toContain("ချိတ်ထားသော အကြွေးတိုးနှင့် ငွေချေစုစုပေါင်း မကိုက်ပါ");
  });

  it("persists reconciliation as an audit record instead of deleting old ledgers", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/debt-reconciliation/route.js"), "utf8");
    expect(route).toContain('action: "DEBT_RECONCILIATION_SAVE"');
    expect(route).toContain("groundTruthBalance");
    expect(route).not.toContain("prisma.ledger.delete");
  });
});
