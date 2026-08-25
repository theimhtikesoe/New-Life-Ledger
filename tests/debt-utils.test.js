import { describe, expect, it } from "vitest";
import { getLatestTransactionDate, getMyanmarDateAgeInDays, getOldestUnpaidCreditDate } from "@/lib/debt-utils";

describe("debt date helpers", () => {
  it("returns the latest ledger transaction date regardless of transaction type", () => {
    const latest = getLatestTransactionDate([
      { date: "2026-07-25", type: "CREDIT", amount: 100000 },
      { date: "2026-08-13", type: "DEBIT", amount: 20000 },
      { date: "2026-08-22", type: "CREDIT", amount: 50000 },
    ]);
    expect(latest).toEqual(new Date("2026-08-22T00:00:00.000Z"));
  });

  it("ignores invalid or missing dates and returns null when none are valid", () => {
    expect(getLatestTransactionDate([{ date: "not-a-date" }, { date: null }, {}])).toBeNull();
    expect(getLatestTransactionDate([])).toBeNull();
  });

  it("calculates the 15-day boundary using Myanmar calendar dates", () => {
    const now = new Date("2026-08-26T12:00:00+06:30");
    expect(getMyanmarDateAgeInDays("2026-08-11", now)).toBe(15);
    expect(getMyanmarDateAgeInDays("2026-08-12", now)).toBe(14);
  });

  it("keeps FIFO oldest-unpaid logic available separately", () => {
    const oldestUnpaid = getOldestUnpaidCreditDate([
      { date: "2026-07-25", type: "CREDIT", amount: 100000 },
      { date: "2026-08-13", type: "DEBIT", amount: 20000 },
      { date: "2026-08-22", type: "CREDIT", amount: 50000 },
    ]);
    expect(oldestUnpaid).toEqual(new Date("2026-07-25T00:00:00.000Z"));
  });
});

