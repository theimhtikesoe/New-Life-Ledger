-- Additive metadata for moving archived Orders to a reversible History Trash.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "historyTrashedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "historyTrashedBy" TEXT;

CREATE INDEX IF NOT EXISTS "Order_historyTrashedAt_idx" ON "Order"("historyTrashedAt");

