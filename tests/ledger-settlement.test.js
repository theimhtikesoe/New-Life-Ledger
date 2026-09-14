import { describe, expect, it, vi } from "vitest";
import { buildSettlementNote, hydrateSettlementSaleTypes, isWholesaleSettlement, normalizeSettlementNote, settlementTargetId } from "@/lib/ledger-settlement";

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

  it("keeps a linked retail credit payment in the payment total", async () => {
    const rows = await hydrateSettlementSaleTypes(
      { ledger: { findMany: vi.fn().mockResolvedValue([{ id: "credit-2", saleType: "RETAIL" }]) } },
      [{ type: "DEBIT", note: "__SETTLES_CREDIT_LEDGER__:credit-2", amount: 200000 }],
    );
    expect(isWholesaleSettlement(rows[0])).toBe(true);
  });

  it("replaces old settlement markers instead of appending another marker", () => {
    const oldNote = "customer note __SETTLES_CREDIT_LEDGER__:old-id __SETTLES_CREDIT_LEDGER__:old-id";
    expect(buildSettlementNote(oldNote, { targetId: "new-id" })).toBe("customer note __SETTLES_CREDIT_LEDGER__:new-id");
    expect(normalizeSettlementNote(oldNote)).toBe("customer note __SETTLES_CREDIT_LEDGER__:old-id");
  });
});

export {};
