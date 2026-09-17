import { describe, expect, it } from "vitest";
import { buildDailyBottleSalesSummary } from "../src/lib/daily-bottle-sales.js";

describe("shared daily bottle sales summary", () => {
  it("counts cash and credit sales once while keeping debit payments separate", () => {
    const summary = buildDailyBottleSalesSummary({
      cashSales: [{ id: "cash-1", amount: 100, saleItems: [{ productKey: "bottle::100", productName: "Bottle", capacity: 100, cardCount: 2, bottleCount: 200, totalAmount: 100 }] }],
      creditLedgers: [{ id: "credit-1", amount: 200, saleItems: [{ productKey: "bottle::100", productName: "Bottle", capacity: 100, cardCount: 3, bottleCount: 300, totalAmount: 200 }] }],
      ledgers: [{ id: "debit-1", amount: 200, type: "DEBIT", saleItems: [{ productKey: "bottle::100", productName: "Bottle", capacity: 100, cardCount: 3, bottleCount: 300, totalAmount: 200 }] }],
    });

    expect(summary.totalBottles).toBe(500);
    expect(summary.totalAmount).toBe(300);
    expect(summary.cashBottleSales.totalBottles).toBe(200);
    expect(summary.creditBottleSales.totalBottles).toBe(300);
    expect(summary.paidBottleSales.totalBottles).toBe(300);
  });

  it("keeps capacities separate when product keys are reused by legacy rows", () => {
    const summary = buildDailyBottleSalesSummary({
      cashSales: [{ id: "cash-1", amount: 100, saleItems: [
        { productKey: "legacy", productName: "Bottle", capacity: 100, bottleCount: 100, totalAmount: 50 },
        { productKey: "legacy", productName: "Bottle", capacity: 250, bottleCount: 250, totalAmount: 50 },
      ] }],
    });

    expect(summary.cashBottleSales.items).toHaveLength(2);
    expect(summary.cashBottleSales.totalBottles).toBe(350);
  });
});
