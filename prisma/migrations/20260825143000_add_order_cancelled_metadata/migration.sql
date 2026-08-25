-- Additive Cancelled Trash metadata only. This does not delete or update existing rows.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
CREATE INDEX IF NOT EXISTS "Order_cancelledAt_idx" ON "Order"("cancelledAt");
