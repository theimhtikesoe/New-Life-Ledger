-- Additive cash-sale records. CashSale rows are separate from Ledger and do not affect Customer.current_balance.
CREATE TABLE IF NOT EXISTS "CashSale" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerId" UUID NOT NULL,
  "saleType" TEXT NOT NULL DEFAULT 'RETAIL',
  "itemSize" TEXT,
  "cartons" INTEGER,
  "rate" INTEGER,
  "deductions" INTEGER NOT NULL DEFAULT 0,
  "amount" INTEGER NOT NULL,
  "note" TEXT,
  "paymentType" TEXT,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashSale_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CashSale_customerId_idx" ON "CashSale"("customerId");
CREATE INDEX IF NOT EXISTS "CashSale_date_idx" ON "CashSale"("date");
