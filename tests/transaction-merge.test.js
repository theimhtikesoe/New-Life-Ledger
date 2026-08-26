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
});
