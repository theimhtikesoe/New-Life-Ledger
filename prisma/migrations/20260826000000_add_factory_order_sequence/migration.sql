-- Additive factory-group sequence metadata. Existing orders remain unchanged.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "factoryOrderDate" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "factoryOrderNumber" INTEGER;

CREATE INDEX IF NOT EXISTS "Order_factoryOrderDate_idx" ON "Order"("factoryOrderDate");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_factoryOrderDate_factoryOrderNumber_key"
  ON "Order"("factoryOrderDate", "factoryOrderNumber");

