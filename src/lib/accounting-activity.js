const ORDER_ENTITY_TYPES = new Set(["Order", "OrderBatch"]);

export function isOrderWorkflowActivity(log) {
  const entityType = String(log?.entityType || "").trim();
  const action = String(log?.action || "").trim().toUpperCase();
  return ORDER_ENTITY_TYPES.has(entityType) || action.startsWith("ORDER_");
}

export function accountingAuditLogWhere() {
  return {
    NOT: [
      { entityType: "Order" },
      { entityType: "OrderBatch" },
      { action: { startsWith: "ORDER_" } },
    ],
  };
}
