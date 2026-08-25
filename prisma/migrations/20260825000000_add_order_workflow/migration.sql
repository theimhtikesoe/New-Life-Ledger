-- Additive only: Order workflow tables. No existing ledger/customer rows are changed.
CREATE TABLE IF NOT EXISTS "Order" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "requestedDate" TEXT NOT NULL DEFAULT '',
  "sourceChatId" TEXT,
  "sourceMessageId" TEXT,
  "sourceUpdateId" TEXT,
  "sourceText" TEXT NOT NULL,
  "customerId" UUID,
  "draftCustomerName" TEXT,
  "draftCustomerPhone" TEXT,
  "customerPhone" TEXT,
  "missingFields" JSONB,
  "aiConfidence" TEXT,
  "aiNotes" TEXT,
  "destination" TEXT,
  "notificationMode" TEXT NOT NULL DEFAULT 'IMMEDIATE',
  "confirmedBy" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Order_sourceChatId_sourceMessageId_key" ON "Order"("sourceChatId", "sourceMessageId");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_sourceUpdateId_key" ON "Order"("sourceUpdateId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "Order_requestedDate_idx" ON "Order"("requestedDate");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");

CREATE TABLE IF NOT EXISTS "OrderLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "bottleType" TEXT,
  "capacityMl" INTEGER,
  "capacityLabel" TEXT,
  "bottlesPerCard" INTEGER,
  "cardCount" INTEGER,
  "totalBottles" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrderLine_orderId_lineNumber_key" ON "OrderLine"("orderId", "lineNumber");
CREATE INDEX IF NOT EXISTS "OrderLine_orderId_idx" ON "OrderLine"("orderId");

CREATE TABLE IF NOT EXISTS "OrderCap" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "capType" TEXT NOT NULL,
  "normalPcs" INTEGER NOT NULL DEFAULT 0,
  "extraPcs" INTEGER NOT NULL DEFAULT 0,
  "requestedTotalPcs" INTEGER NOT NULL DEFAULT 0,
  "expectedPcs" INTEGER,
  "warningText" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderCap_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderCap_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrderCap_orderId_capType_key" ON "OrderCap"("orderId", "capType");
CREATE INDEX IF NOT EXISTS "OrderCap_orderId_idx" ON "OrderCap"("orderId");

CREATE TABLE IF NOT EXISTS "OrderDelivery" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "destinationType" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "telegramChatId" TEXT,
  "telegramMessageId" TEXT,
  "sentAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrderDelivery_orderId_destinationType_mode_key" ON "OrderDelivery"("orderId", "destinationType", "mode");
CREATE INDEX IF NOT EXISTS "OrderDelivery_status_idx" ON "OrderDelivery"("status");
CREATE INDEX IF NOT EXISTS "OrderDelivery_mode_idx" ON "OrderDelivery"("mode");

CREATE TABLE IF NOT EXISTS "OrderAutomationSetting" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "morningBatchEnabled" BOOLEAN NOT NULL DEFAULT true,
  "morningBatchTime" TEXT NOT NULL DEFAULT '08:10',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAutomationSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderBatchRun" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "batchDate" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "orderCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderBatchRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrderBatchRun_batchDate_key" ON "OrderBatchRun"("batchDate");
CREATE INDEX IF NOT EXISTS "OrderBatchRun_status_idx" ON "OrderBatchRun"("status");
