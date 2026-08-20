CREATE TABLE IF NOT EXISTS "AutoReportRun" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "status" TEXT NOT NULL,
  "trigger" TEXT NOT NULL DEFAULT 'schedule',
  "reportDate" TEXT,
  "periodLabel" TEXT,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "counts" JSONB,
  "elapsedMs" INTEGER,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutoReportRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AutoReportRun_createdAt_idx" ON "AutoReportRun"("createdAt");
CREATE INDEX IF NOT EXISTS "AutoReportRun_reportDate_idx" ON "AutoReportRun"("reportDate");
CREATE INDEX IF NOT EXISTS "AutoReportRun_status_idx" ON "AutoReportRun"("status");
