-- Track customer-specific discounts separately from the cash actually received.
-- Existing ledger rows remain unchanged and default to zero discount.
ALTER TABLE "Ledger"
  ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Ledger"
  ADD CONSTRAINT "Ledger_discountAmount_nonnegative"
  CHECK ("discountAmount" >= 0);

CREATE INDEX IF NOT EXISTS "Ledger_discountAmount_idx" ON "Ledger"("discountAmount");

ALTER TABLE "Ledger"
  ADD COLUMN IF NOT EXISTS "discountNote" TEXT;
