-- Match the customer transaction list query: customer filter plus newest-created ordering.
CREATE INDEX IF NOT EXISTS "Ledger_customerId_createdAt_id_idx"
  ON "Ledger"("customerId", "createdAt", "id");

CREATE INDEX IF NOT EXISTS "CashSale_customerId_createdAt_id_idx"
  ON "CashSale"("customerId", "createdAt", "id");
