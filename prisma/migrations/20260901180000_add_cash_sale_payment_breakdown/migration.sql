-- Additive-only payment split support. Existing CashSale rows remain unchanged.
ALTER TABLE "CashSale" ADD COLUMN IF NOT EXISTS "paymentBreakdown" JSONB;
