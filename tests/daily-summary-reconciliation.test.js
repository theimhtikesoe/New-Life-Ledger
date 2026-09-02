import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(process.cwd(), "src/app/daily-summary/page.js"), "utf8");
const helperSource = readFileSync(resolve(process.cwd(), "src/lib/daily-summary-review.js"), "utf8");

describe("Daily Summary reconciliation", () => {
  it("keeps the detail panel on demand instead of adding it to the main summary", () => {
    expect(pageSource).toContain('onClick={handleReconciliation}');
    expect(pageSource).toContain('reconciliationOpen && <ReconciliationPanel');
    expect(pageSource).toContain("Payment Matrix · လက်လီ / လက်ကား × Payment");
    expect(pageSource).toContain("Source records အပြည့်အစုံ");
  });

  it("exposes auto/reference differences and exact-amount candidates", () => {
    expect(helperSource).toContain("export function buildDailyReconciliation");
    expect(helperSource).toContain("paymentMatrix: buildPaymentMatrixSummary(cashSales)");
    expect(helperSource).toContain("const candidates = candidateAmount > 0");
    expect(helperSource).toContain('status: nonZeroDifference ? "REVIEW" : "MATCHED"');
  });
});

export {};
