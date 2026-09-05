CREATE TABLE "ProductionWorker" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionWorker_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductionWorker_name_key" ON "ProductionWorker"("name");
CREATE INDEX "ProductionWorker_active_idx" ON "ProductionWorker"("active");
