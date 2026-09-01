import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("Cash-sale payment breakdown removal", () => {
  it("keeps the cash-sale form focused on the normal payment type", () => {
    expect(source).toContain('value={ledgerForm.paymentType}');
    expect(source).not.toContain("showPaymentBreakdown");
    expect(source).not.toContain("Payment ခွဲထည့်ရန်");
    expect(source).not.toContain("ledgerForm.paymentBreakdown");
    expect(source).not.toContain("paymentBreakdown: Object.fromEntries");
  });
});

export {};
