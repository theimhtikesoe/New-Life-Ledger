-- Preserve AuditLog rows while allowing users to hide individual Activity History lines.
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "hiddenBy" TEXT;
CREATE INDEX IF NOT EXISTS "AuditLog_hiddenAt_idx" ON "AuditLog"("hiddenAt");
