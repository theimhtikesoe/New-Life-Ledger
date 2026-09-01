import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("Cash-sale automatic type selection", () => {
  it("uses the selected customer type when the user leaves retail/wholesale unselected", () => {
    expect(source).toContain("customerDefaultCashSaleType");
    expect(source).toContain("const effectiveCashSaleType = ledgerForm.saleType || customerDefaultCashSaleType(selectedCustomer);");
    expect(source).toContain("saleType: isCashSale ? effectiveCashSaleType : ledgerForm.saleType");
    expect(source).toContain('saleType: ledgerForm.type === "CASH_SALE" ? ledgerForm.saleType : ""');
    expect(source).toContain("မရွေးထားပါက Customer အမျိုးအစားအတိုင်း အလိုအလျောက်သိမ်းမည်");
  });
});

export {};
