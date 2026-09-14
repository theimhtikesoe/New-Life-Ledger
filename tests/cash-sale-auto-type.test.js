import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("Transaction retail/wholesale confirmation", () => {
  it("requires an explicit type choice before sending the transaction", () => {
    expect(source).toContain("customerDefaultCashSaleType");
    expect(source).toContain("const effectiveCashSaleType = ledgerForm.saleType || customerDefaultCashSaleType(selectedCustomer);");
    expect(source).toContain("saleType: saleTypeOverride || (isCashSale ? effectiveCashSaleType : ledgerForm.saleType)");
    expect(source).toContain("if (!pendingTransactionConfirmation?.saleType) return;");
    expect(source).toContain("လက်လီ သို့မဟုတ် လက်ကား တစ်ခုကို မဖြစ်မနေရွေးပြီးမှ data သိမ်းပါမည်");
    expect(source).toContain("disabled={isSubmitting || !pendingTransactionConfirmation.saleType}");
  });
});

export {};
