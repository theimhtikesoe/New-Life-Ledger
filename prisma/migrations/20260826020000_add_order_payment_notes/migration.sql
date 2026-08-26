-- Additive fields for mixed-format order payment and receipt instructions.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentType" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentNote" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "receiptNote" TEXT;

ALTER TABLE "OrderLine" ADD COLUMN IF NOT EXISTS "quotedRate" INTEGER;
ALTER TABLE "OrderLine" ADD COLUMN IF NOT EXISTS "quotedAmount" INTEGER;

