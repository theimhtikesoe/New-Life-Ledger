import { describe, expect, it, vi } from "vitest";
import { dedupeSettledBottleSaleItems, hydrateSettledBottleSaleItems, settlementTargetId } from "@/lib/bottle-sales-ledger";

describe("settled bottle sales ledger hydration", () => {
  it("keeps numeric-looking settlement IDs as strings", () => {
    expect(settlementTargetId("__SETTLES_CREDIT_LEDGER__:4")).toBe("4");
  });

  it("queries Prisma with string IDs and restores the source sale items", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "4", saleItems: [{ productKey: "bottle-20", capacity: 20, bottleCount: 40, totalAmount: 12000 }] }]);
    const db = { ledger: { findMany } };
    const rows = await hydrateSettledBottleSaleItems(db, [{
      id: "payment-1",
      type: "DEBIT",
      note: "__SETTLES_CREDIT_LEDGER__:4",
      saleItems: [],
    }]);

    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ["4"] } },
      select: { id: true, saleItems: true },
    });
    expect(rows[0].saleItems[0].bottleCount).toBe(40);
  });

  it("keeps the source bottle sale once when one credit is paid in two parts", () => {
    const rows = dedupeSettledBottleSaleItems([
      { type: "DEBIT", note: "__SETTLES_CREDIT_LEDGER__:credit-1", saleItems: [{ productKey: "bottle-20", bottleCount: 40, totalAmount: 12000 }] },
      { type: "DEBIT", note: "__SETTLES_CREDIT_LEDGER__:credit-1", saleItems: [{ productKey: "bottle-20", bottleCount: 40, totalAmount: 12000 }] },
    ]);
    expect(rows[0].saleItems).toHaveLength(1);
    expect(rows[1].saleItems).toEqual([]);
  });
});
