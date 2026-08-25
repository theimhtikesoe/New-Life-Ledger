-- Additive Telegram draft reply metadata only. This does not delete or update existing rows.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "telegramDraftChatId" TEXT,
  ADD COLUMN IF NOT EXISTS "telegramDraftMessageId" TEXT;
