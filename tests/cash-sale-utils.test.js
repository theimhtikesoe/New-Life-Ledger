import { describe, expect, it } from "vitest";
import { cashSaleTypeLabel, normalizeCashSaleType, summarizeCashSalesByType } from "@/lib/cash-sale-utils";

describe("CashSale type helpers", () => {
  it("normalizes known types and defaults unknown values to retail", () => {
    expect(normalizeCashSaleType("wholesale")).toBe("WHOLESALE");
    expect(normalizeCashSaleType("လက်ကား")).toBe("WHOLESALE");
    expect(normalizeCashSaleType("unknown")).toBe("RETAIL");
    expect(cashSaleTypeLabel("WHOLESALE")).toBe("လက်ကား");
    expect(cashSaleTypeLabel("RETAIL")).toBe("လက်လီ");
  });

  it("summarizes retail and wholesale sales separately", () => {
    expect(summarizeCashSalesByType([
      { saleType: "RETAIL", amount: 100000 },
      { saleType: "wholesale", amount: 250000 },
      { saleType: "", amount: 50000 },
    ])).toEqual({
      RETAIL: { count: 2, amount: 150000 },
      WHOLESALE: { count: 1, amount: 250000 },
    });
  });
});
