import { describe, expect, it } from "vitest";
import { getPaymentSplit, paymentSplitForInput, paymentSplitTotal } from "@/lib/payment-split";

describe("payment split", () => {
  it("parses a legacy mixed-payment note without changing the full total", () => {
    const split = getPaymentSplit({
      amount: 1215000,
      paymentType: "CASH",
      note: "Cash 700000 b/ Kpay 515000",
    });

    expect(split).toEqual({ CASH: 700000, KPAY: 515000, BANK: 0, WAVE: 0, SPECIAL: 0 });
    expect(paymentSplitTotal(split)).toBe(1215000);
  });

  it("accepts explicit split amounts for a new CashSale", () => {
    const split = paymentSplitForInput({
      paymentType: "CASH",
      paymentBreakdown: { CASH: 700000, KPAY: 515000, BANK: 0, WAVE: 0, SPECIAL: 0 },
    }, 1215000);

    expect(split.CASH).toBe(700000);
    expect(split.KPAY).toBe(515000);
    expect(paymentSplitTotal(split)).toBe(1215000);
  });

  it("falls back to the selected payment type for legacy single-payment rows", () => {
    const split = getPaymentSplit({ amount: 500000, paymentType: "KPAY", note: null });
    expect(split).toEqual({ CASH: 0, KPAY: 500000, BANK: 0, WAVE: 0, SPECIAL: 0 });
  });
});
