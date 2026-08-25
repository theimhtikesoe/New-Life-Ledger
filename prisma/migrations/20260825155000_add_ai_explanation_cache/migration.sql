CREATE TABLE IF NOT EXISTS "AiExplanationCache" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reportDate" TEXT NOT NULL,
  "dataFingerprint" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL DEFAULT 'v2',
  "explanation" JSONB NOT NULL,
  "generatedBy" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiExplanationCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiExplanationCache_reportDate_dataFingerprint_promptVersion_key"
  ON "AiExplanationCache" ("reportDate", "dataFingerprint", "promptVersion");

CREATE INDEX IF NOT EXISTS "AiExplanationCache_reportDate_idx"
  ON "AiExplanationCache" ("reportDate");

CREATE INDEX IF NOT EXISTS "AiExplanationCache_reportDate_updatedAt_idx"
  ON "AiExplanationCache" ("reportDate", "updatedAt");
