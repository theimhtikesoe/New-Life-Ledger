const ORDER_ENTITY_TYPES = new Set(["Order", "OrderBatch"]);
const DAILY_SALES_ACTIVITY_ACTIONS = new Set(["DAILY_SALES_OPENING", "DAILY_SALES_SUMMARY"]);

export function isDailySalesActivity(log) {
  return DAILY_SALES_ACTIVITY_ACTIONS.has(String(log?.action || "").trim().toUpperCase());
}

export function isOrderWorkflowActivity(log) {
  const entityType = String(log?.entityType || "").trim();
  const action = String(log?.action || "").trim().toUpperCase();
  return ORDER_ENTITY_TYPES.has(entityType) || action.startsWith("ORDER_");
}

export function isCustomerEditActivity(log) {
  const entityType = String(log?.entityType || "").trim().toLowerCase();
  const action = String(log?.action || "").trim().toUpperCase();
  return entityType === "customer" && action === "UPDATE";
}

export function isEditActivity(log) {
  const action = String(log?.action || "").trim().toUpperCase();
  return action === "UPDATE" || action.endsWith("_UPDATE");
}

export function isProductionReportDeleteActivity(log) {
  return String(log?.action || "").trim().toUpperCase() === "PRODUCTION_REPORT_DELETE";
}

export function accountingAuditLogWhere() {
  return {
    NOT: [
      { entityType: "Order" },
      { entityType: "OrderBatch" },
      { action: { startsWith: "ORDER_" } },
      { action: { in: [...DAILY_SALES_ACTIVITY_ACTIONS] } },
      { action: "PRODUCTION_REPORT_DELETE" },
    ],
  };
}
