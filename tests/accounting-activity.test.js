import { describe, expect, it } from "vitest";
import { accountingAuditLogWhere, isOrderWorkflowActivity } from "@/lib/accounting-activity";

describe("Accounting activity scope", () => {
  it("recognizes Order entity types and ORDER-prefixed actions", () => {
    expect(isOrderWorkflowActivity({ entityType: "Order", action: "ORDER_DRAFT" })).toBe(true);
    expect(isOrderWorkflowActivity({ entityType: "OrderBatch", action: "ORDER_BATCH_NOTIFIED" })).toBe(true);
    expect(isOrderWorkflowActivity({ entityType: "Operational", action: "ORDER_CUSTOM_ACTION" })).toBe(true);
  });

  it("keeps accounting entities outside the Order workflow scope", () => {
    expect(isOrderWorkflowActivity({ entityType: "Ledger", action: "PAYMENT" })).toBe(false);
    expect(isOrderWorkflowActivity({ entityType: "CashSale", action: "CASH_SALE" })).toBe(false);
    expect(isOrderWorkflowActivity({ entityType: "Customer", action: "UPDATE" })).toBe(false);
  });

  it("builds a Prisma exclusion for both Order entity types and ORDER actions", () => {
    expect(accountingAuditLogWhere()).toEqual({
      NOT: [
        { entityType: "Order" },
        { entityType: "OrderBatch" },
        { action: { startsWith: "ORDER_" } },
      ],
    });
  });
});
