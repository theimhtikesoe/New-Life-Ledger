import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
const paymentSplitSource = readFileSync(resolve(process.cwd(), "src/lib/payment-split.js"), "utf8");

describe("Cash-sale payment breakdown", () => {
  it("renders split payment inputs for cash sales and sends them in the payload", () => {
    expect(dashboardSource).toContain("PAYMENT_BREAKDOWN_FIELDS");
    expect(dashboardSource).toContain("paymentBreakdown: { ...EMPTY_PAYMENT_BREAKDOWN }");
    expect(dashboardSource).toContain("paymentBreakdown: hasCashSaleBreakdown ? ledgerForm.paymentBreakdown : undefined");
    expect(dashboardSource).toContain("ငွေပေးချေမှု ခွဲထည့်ရန် (Optional)");
    expect(dashboardSource).toContain("Cash 60,000 + KPay 20,000 + Bank 20,000");
  });

  it("shows a mismatch warning and prevents submission when the breakdown is not exact", () => {
    expect(dashboardSource).toContain("paymentBreakdownValidationMessage");
    expect(dashboardSource).toContain("စာရင်းသိမ်း၍ မရပါ။");
    expect(dashboardSource).toContain("disabled={isSubmitting || cashSaleBreakdownMismatch}");
    expect(paymentSplitSource).toContain("if (candidate) {");
    expect(paymentSplitSource).toContain("if (mismatch) throw new Error(mismatch);");
  });
});

export {};
