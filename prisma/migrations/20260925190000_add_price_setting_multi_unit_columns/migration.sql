-- Add optional multi-unit prices used by packaging-bag and glue price settings.
-- Keep this migration idempotent for databases that were initialized by the
-- runtime bootstrap before Prisma migrations were applied.
ALTER TABLE "PriceSetting"
  ADD COLUMN IF NOT EXISTS "pricePerPack" INTEGER,
  ADD COLUMN IF NOT EXISTS "pricePerLb" INTEGER,
  ADD COLUMN IF NOT EXISTS "pricePerKg" INTEGER,
  ADD COLUMN IF NOT EXISTS "pricePerSack" INTEGER;
