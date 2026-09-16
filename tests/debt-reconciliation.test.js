import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("debt reconciliation workflow", () => {
  it("exposes a customer-by-customer reconciliation page from the dashboard", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "src/app/debt-reconciliation/page.js"), "utf8");
    expect(dashboard).toContain('href="/debt-reconciliation"');
    expect(page).toContain("မြေပြင်နောက်ဆုံးလက်ကျန်");
    expect(page).toContain("စာရင်းညှိ သိမ်းမည်");
    expect(page).toContain("မူရင်း transaction မပျက်ပါ");
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
