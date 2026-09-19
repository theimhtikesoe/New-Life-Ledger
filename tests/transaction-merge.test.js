import { describe, expect, it } from "vitest";
import { mergeTransactionsWithCashSales } from "@/components/Dashboard";

describe("Customer transaction row merge", () => {
  it("adds CashSale as a first-class transaction row without changing Ledger rows", () => {
    const ledgers = [{ id: "ledger-1", type: "CREDIT", amount: 100000, date: "2026-08-26T08:00:00.000Z" }];
    const cashSales = [{ id: "cash-1", amount: 50000, paymentType: "CASH", date: "2026-08-26T09:00:00.000Z" }];
    const rows = mergeTransactionsWithCashSales(ledgers, cashSales);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "cash-1", type: "CASH_SALE", recordType: "CASH_SALE", amount: 50000, paymentType: "CASH" });
    expect(rows[1]).toBe(ledgers[0]);
  });

  it("puts the newest created record first even when its accounting date is older", () => {
    const olderDateButNewerRecord = {
      id: "ledger-new",
      type: "CREDIT",
      amount: 200000,
      date: "2026-08-20T00:00:00.000Z",
      createdAt: "2026-08-26T10:00:00.000Z",
    };
    const newerDateButOlderRecord = {
      id: "ledger-old",
      type: "CREDIT",
      amount: 100000,
      date: "2026-08-26T00:00:00.000Z",
      createdAt: "2026-08-26T09:00:00.000Z",
    };

    expect(mergeTransactionsWithCashSales([newerDateButOlderRecord, olderDateButNewerRecord], []).map((row) => row.id)).toEqual(["ledger-new", "ledger-old"]);
  });

  it("keeps an edited record in its created position when only its accounting date changes", () => {
    const editedRecord = {
      id: "ledger-edited",
      type: "CREDIT",
      date: "2026-08-01T00:00:00.000Z",
      createdAt: "2026-08-26T10:00:00.000Z",
    };
    const laterRecord = {
      id: "ledger-later",
      type: "CREDIT",
      date: "2026-08-26T00:00:00.000Z",
      createdAt: "2026-08-26T09:00:00.000Z",
    };

    expect(mergeTransactionsWithCashSales([editedRecord, laterRecord], []).map((row) => row.id)).toEqual(["ledger-edited", "ledger-later"]);
  });
});
