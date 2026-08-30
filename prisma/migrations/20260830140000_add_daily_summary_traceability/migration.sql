-- Additive-only traceability fields. Existing DailySalesSummary rows remain unchanged.
ALTER TABLE "DailySalesSummary" ADD COLUMN IF NOT EXISTS "calculationMode" TEXT;
ALTER TABLE "DailySalesSummary" ADD COLUMN IF NOT EXISTS "sourceSnapshotAt" TIMESTAMP(3);
ALTER TABLE "DailySalesSummary" ADD COLUMN IF NOT EXISTS "sourceTransactionCount" INTEGER;
ALTER TABLE "DailySalesSummary" ADD COLUMN IF NOT EXISTS "sourceTransactionTotal" INTEGER;
ALTER TABLE "DailySalesSummary" ADD COLUMN IF NOT EXISTS "adjustmentReason" TEXT;
ALTER TABLE "DailySalesSummary" ADD COLUMN IF NOT EXISTS "lastCalculatedAt" TIMESTAMP(3);
ALTER TABLE "DailySalesSummary" ADD COLUMN IF NOT EXISTS "lastCalculatedBy" TEXT;
