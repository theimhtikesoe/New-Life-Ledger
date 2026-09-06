import { describe, expect, it } from "vitest";
import { accountingAuditLogWhere, isDailySalesActivity, isEditActivity, isOrderWorkflowActivity, isProductionReportSubmitActivity, isProductionWorkerCreateActivity } from "@/lib/accounting-activity";

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

  it("recognizes Daily Sales bookkeeping actions as hidden from Activity History", () => {
    expect(isDailySalesActivity({ action: "DAILY_SALES_OPENING" })).toBe(true);
    expect(isDailySalesActivity({ action: "DAILY_SALES_SUMMARY" })).toBe(true);
    expect(isDailySalesActivity({ action: "CASH_SALE" })).toBe(false);
  });

  it("recognizes production report submissions as hidden activity", () => {
    expect(isProductionReportSubmitActivity({ action: "PRODUCTION_REPORT_SUBMIT" })).toBe(true);
    expect(isProductionReportSubmitActivity({ action: "PRODUCTION_REPORT_UPDATE" })).toBe(false);
  });

  it("recognizes worker creation as hidden activity", () => {
    expect(isProductionWorkerCreateActivity({ action: "PRODUCTION_WORKER_CREATE" })).toBe(true);
    expect(isProductionWorkerCreateActivity({ action: "PRODUCTION_WORKER_DELETE" })).toBe(false);
  });

  it("recognizes edit/update actions as excluded report activity", () => {
    expect(isEditActivity({ action: "UPDATE" })).toBe(true);
    expect(isEditActivity({ action: "ORDER_DETAILS_UPDATE" })).toBe(true);
    expect(isEditActivity({ action: "PAYMENT" })).toBe(false);
  });

  it("builds a Prisma exclusion for both Order entity types and ORDER actions", () => {
    expect(accountingAuditLogWhere()).toEqual({
      NOT: [
        { entityType: "Order" },
        { entityType: "OrderBatch" },
      { action: { startsWith: "ORDER_" } },
      { action: { in: ["DAILY_SALES_OPENING", "DAILY_SALES_SUMMARY"] } },
      { action: "PRODUCTION_REPORT_DELETE" },
      { action: "PRODUCTION_REPORT_SUBMIT" },
      { action: "PRODUCTION_WORKER_CREATE" },
    ],
    });
  });
});
