-- Additive Order archive metadata only. This does not delete or update existing rows.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "archivedBy" TEXT;
CREATE INDEX IF NOT EXISTS "Order_archivedAt_idx" ON "Order"("archivedAt");
