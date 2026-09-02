import { describe, expect, it } from "vitest";
import { getPaymentSplit, paymentSplitForInput, paymentSplitLabel, paymentSplitTotal } from "@/lib/payment-split";

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

  it("formats each non-zero payment category for display", () => {
    expect(paymentSplitLabel({ CASH: 60000, KPAY: 20000, BANK: 20000, WAVE: 0, SPECIAL: 0 })).toBe("CASH 60,000 Ks + KPAY 20,000 Ks + BANK 20,000 Ks");
  });

  it("rejects a breakdown that is larger than the main amount", () => {
    expect(() => paymentSplitForInput({
      paymentType: "CASH",
      paymentBreakdown: { CASH: 60000, KPAY: 50000, BANK: 0, WAVE: 0, SPECIAL: 0 },
    }, 100000)).toThrow(/ပိုနေပါသည်/);
  });

  it("rejects a breakdown that is smaller than the main amount", () => {
    expect(() => paymentSplitForInput({
      paymentType: "CASH",
      paymentBreakdown: { CASH: 60000, KPAY: 20000, BANK: 10000, WAVE: 0, SPECIAL: 0 },
    }, 100000)).toThrow(/လျော့နေပါသည်/);
  });

  it("falls back to the selected payment type for legacy single-payment rows", () => {
    const split = getPaymentSplit({ amount: 500000, paymentType: "KPAY", note: null });
    expect(split).toEqual({ CASH: 0, KPAY: 500000, BANK: 0, WAVE: 0, SPECIAL: 0 });
  });
});
