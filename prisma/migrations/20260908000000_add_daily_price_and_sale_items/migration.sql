-- Daily product price snapshots and structured sale item lines.
ALTER TABLE "Ledger"
  ADD COLUMN IF NOT EXISTS "saleItems" JSONB;

ALTER TABLE "CashSale"
  ADD COLUMN IF NOT EXISTS "saleItems" JSONB;

CREATE TABLE IF NOT EXISTS "PriceSetting" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "priceDate" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'ITEM',
  "categoryKey" TEXT NOT NULL,
  "productKey" TEXT NOT NULL,
  "productType" TEXT NOT NULL DEFAULT 'bottle',
  "productName" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 0,
  "bottlesPerCard" INTEGER NOT NULL DEFAULT 0,
  "pricePerBottle" INTEGER NOT NULL,
  "pricePerCard" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceSetting_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PriceSetting" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'ITEM';
ALTER TABLE "PriceSetting" ADD COLUMN IF NOT EXISTS "categoryKey" TEXT NOT NULL DEFAULT 'candy';
ALTER TABLE "PriceSetting" ADD COLUMN IF NOT EXISTS "capacity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PriceSetting" ADD COLUMN IF NOT EXISTS "bottlesPerCard" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PriceSetting" ADD COLUMN IF NOT EXISTS "pricePerCard" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "PriceSetting_priceDate_productKey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PriceSetting_priceDate_scope_productKey_key"
  ON "PriceSetting"("priceDate", "scope", "productKey");

CREATE INDEX IF NOT EXISTS "PriceSetting_priceDate_idx"
  ON "PriceSetting"("priceDate");

CREATE INDEX IF NOT EXISTS "PriceSetting_productKey_idx"
  ON "PriceSetting"("productKey");
