import { describe, expect, it, vi } from "vitest";
import { hydrateSettlementSaleTypes, isWholesaleSettlement, settlementTargetId } from "@/lib/ledger-settlement";

describe("ledger settlement classification", () => {
  it("extracts the linked credit ledger ID from a payment note", () => {
    expect(settlementTargetId("__SETTLES_CREDIT_LEDGER__:credit-1")).toBe("credit-1");
    expect(settlementTargetId("__PREPAYMENT__")).toBeNull();
  });

  it("classifies a payment from the linked credit sale type", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "credit-1", saleType: "WHOLESALE" }]);
    const rows = await hydrateSettlementSaleTypes({ ledger: { findMany } }, [{
      id: "payment-1",
      type: "DEBIT",
      note: "__SETTLES_CREDIT_LEDGER__:credit-1",
      amount: 410000,
    }]);
    expect(isWholesaleSettlement(rows[0])).toBe(true);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["credit-1"] } } }));
  });

  it("does not treat a linked retail credit as wholesale", async () => {
    const rows = await hydrateSettlementSaleTypes(
      { ledger: { findMany: vi.fn().mockResolvedValue([{ id: "credit-2", saleType: "RETAIL" }]) } },
      [{ type: "DEBIT", note: "__SETTLES_CREDIT_LEDGER__:credit-2", amount: 200000 }],
    );
    expect(isWholesaleSettlement(rows[0])).toBe(false);
  });
});

export {};
