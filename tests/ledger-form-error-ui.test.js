import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("Ledger form validation feedback", () => {
  it("renders validation errors beside the ledger form instead of as a top error alert", () => {
    expect(source).toContain("function LedgerFormError({ message })");
    expect(source).toContain("<LedgerFormError message={ledgerFormError} />");
    expect(source).toContain("{alert?.type === \"success\" && (");
  });

  it("validates dates before setting submitting/loading state", () => {
    expect(source).toContain("setLedgerFormError(\"\");");
    expect(source).toContain("if (selectedLedgerDate > currentMyanmarDate)");
    expect(source).toContain("if (ledgerForm.type === \"DEBIT\" && selectedPaymentTarget");
    expect(source).toContain("setIsSubmitting(true);");
  });

  it("keeps rejected saves on the form without refreshing the customer", () => {
    expect(source).toContain("setLedgerFormError(error.message ||");
    expect(source).toContain("if (error.status && error.status >= 500) await loadCustomer(selectedCustomerId);");
  });
});

export {};
