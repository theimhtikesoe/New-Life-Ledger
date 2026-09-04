CREATE TABLE "ProductionReport" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "submissionId" TEXT NOT NULL,
  "reportDate" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "machineCode" TEXT NOT NULL,
  "machineName" TEXT,
  "category" TEXT NOT NULL,
  "outputQuantity" INTEGER NOT NULL,
  "outputUnit" TEXT NOT NULL,
  "outputCapacity" TEXT,
  "bottleType" TEXT,
  "tubeG" TEXT,
  "tubeColor" TEXT,
  "wasteQuantity" INTEGER NOT NULL DEFAULT 0,
  "wasteNote" TEXT,
  "damagedPieces" INTEGER NOT NULL DEFAULT 0,
  "involvedWorkers" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionReport_reportDate_idx" ON "ProductionReport"("reportDate");
CREATE INDEX "ProductionReport_submissionId_idx" ON "ProductionReport"("submissionId");
CREATE INDEX "ProductionReport_machineCode_idx" ON "ProductionReport"("machineCode");
