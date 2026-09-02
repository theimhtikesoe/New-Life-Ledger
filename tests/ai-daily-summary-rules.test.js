import { describe, expect, it } from "vitest";
import { buildDailySummaryReviewChecks, transactionsToDailySummaryEvents } from "@/lib/daily-summary-review";

describe("Daily Summary automatic review rules", () => {
  it("flags repeated same-customer same-amount ledger records", () => {
    const checks = buildDailySummaryReviewChecks({
      totalTransactions: 3,
      activityTotal: 3,
      events: [
        { action: "ငွေချေ", entityType: "Ledger", customerName: "ကံလီ", amount: 200000 },
        { action: "အကြွေးတိုး", entityType: "Ledger", customerName: "ကံလီ", amount: 200000 },
        { action: "ငွေချေ", entityType: "Ledger", customerName: "အခြားသူ", amount: 300000 },
      ],
    });
    expect(checks).toHaveLength(1);
    expect(checks[0]).toContain("ကံလီ");
    expect(checks[0]).toContain("200,000 Ks");
    expect(checks[0]).toContain("ပမာဏတူ");
  });

  it("does not flag different amounts or non-ledger events as duplicate amounts", () => {
    const checks = buildDailySummaryReviewChecks({
      totalTransactions: 2,
      activityTotal: 2,
      events: [
        { action: "ငွေချေ", entityType: "Ledger", customerName: "ကံလီ", amount: 200000 },
        { action: "ငွေချေ", entityType: "Ledger", customerName: "ကံလီ", amount: 250000 },
      ],
    });
    expect(checks).toEqual([]);
  });

  it("flags a Customer created on the same day as a ledger entry", () => {
    const checks = buildDailySummaryReviewChecks({
      totalTransactions: 1,
      activityTotal: 2,
      events: [
        { action: "Customer အသစ်ထည့်", entityType: "Customer", entityLabel: "ကံလီ" },
        { action: "ငွေချေ", entityType: "Ledger", customerName: "ကံလီ", amount: 200000 },
      ],
    });
    expect(checks.some((check) => check.includes("ဖန်တီးချိန်") && check.includes("ကံလီ"))).toBe(true);
  });

  it("flags payment-type totals that do not match the paid total", () => {
    const checks = buildDailySummaryReviewChecks({
      totalTransactions: 2,
      activityTotal: 2,
      summary: { paidAmount: 300000, paymentTypes: { KPAY: 200000, Cash: 50000 } },
      customers: [],
      events: [],
    });
    expect(checks.some((check) => check.includes("အကြွေးပြန်ဆပ်(ငွေချေ) စုစုပေါင်း") && check.includes("မကိုက်ပါ"))).toBe(true);
  });

  it("flags duplicate customer display names with different customer ids", () => {
    const checks = buildDailySummaryReviewChecks({
      totalTransactions: 2,
      activityTotal: 2,
      summary: { paidAmount: 300000, unpaidAmount: 0, paymentTypes: { KPAY: 300000 } },
      customers: [
        { customerId: "customer-a", customerName: "ကံလီ", paidAmount: 100000, unpaidAmount: 0 },
        { customerId: "customer-b", customerName: " ကံလီ ", paidAmount: 200000, unpaidAmount: 0 },
      ],
      events: [],
    });
    expect(checks.some((check) => check.includes("Customer အမည်") && check.includes("ကံလီ"))).toBe(true);
  });

  it("does not flag the intentionally different Activity and Ledger counts", () => {
    const checks = buildDailySummaryReviewChecks({ totalTransactions: 5, events: [] });
    expect(checks.some((check) => check.includes("လုပ်ဆောင်ချက်မှတ်တမ်း") && check.includes("မတူပါ"))).toBe(false);
  });

  it("converts raw Daily Summary transactions into review events", () => {
    const events = transactionsToDailySummaryEvents([
      { type: "DEBIT", amount: 1000, date: "2026-08-24T01:00:00.000Z", customer: { name: "ကံလီ" } },
      { type: "CREDIT", amount: 2000, date: "2026-08-24T02:00:00.000Z", customer: { name: "ကံလီ" } },
    ]);
    expect(events).toEqual([
      expect.objectContaining({ action: "ငွေချေ", entityType: "Ledger", customerName: "ကံလီ", amount: 1000 }),
      expect.objectContaining({ action: "အကြွေးတိုး", entityType: "Ledger", customerName: "ကံလီ", amount: 2000 }),
    ]);
  });
});
