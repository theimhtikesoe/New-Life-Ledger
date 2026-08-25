import { NextResponse } from "next/server";
import { ensureDatabase, requireDatabaseUrl } from "@/lib/database";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXPECTED_COLUMNS = ["archivedAt", "archivedBy", "telegramDraftChatId", "telegramDraftMessageId"];
const EXPECTED_INDEX = "Order_archivedAt_idx";

async function schemaSnapshot(client) {
  const columns = await client.$queryRawUnsafe(
    `SELECT column_name AS "columnName" FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name IN (${EXPECTED_COLUMNS.map((name) => `'${name}'`).join(", ")}) ORDER BY column_name`,
  );
  const indexes = await client.$queryRawUnsafe(
    `SELECT indexname AS "indexName" FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Order' AND indexname = '${EXPECTED_INDEX}'`,
  );
  return {
    columns: columns.map((row) => String(row.columnName)).sort(),
    index: indexes.some((row) => String(row.indexName) === EXPECTED_INDEX),
  };
}

async function dataSnapshot(client) {
  const rows = await client.$queryRawUnsafe(`
    SELECT
      (SELECT count(*) FROM "Customer")::text AS "customerCount",
      (SELECT count(*) FROM "Ledger")::text AS "ledgerCount",
      COALESCE((SELECT sum("current_balance") FROM "Customer"), 0)::text AS "customerBalanceSum",
      COALESCE((SELECT sum("amount") FROM "Ledger" WHERE "type" = 'CREDIT'), 0)::text AS "creditSum",
      COALESCE((SELECT sum("amount") FROM "Ledger" WHERE "type" = 'DEBIT'), 0)::text AS "debitSum"
  `);
  const row = rows[0] || {};
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "0")]));
}

export async function POST() {
  try {
    requireDatabaseUrl();
    await ensureDatabase();
    const before = await dataSnapshot(prisma);
    const beforeSchema = await schemaSnapshot(prisma);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)');
      await tx.$executeRawUnsafe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "archivedBy" TEXT');
      await tx.$executeRawUnsafe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "telegramDraftChatId" TEXT');
      await tx.$executeRawUnsafe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "telegramDraftMessageId" TEXT');
      await tx.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Order_archivedAt_idx" ON "Order"("archivedAt")');
      const after = await dataSnapshot(tx);
      const afterSchema = await schemaSnapshot(tx);
      const dataUnchanged = JSON.stringify(before) === JSON.stringify(after);
      const schemaComplete = EXPECTED_COLUMNS.every((name) => afterSchema.columns.includes(name)) && afterSchema.index;
      if (!dataUnchanged || !schemaComplete) throw new Error("Order additive migration verification failed");
      return { before, after, beforeSchema, afterSchema, dataUnchanged, schemaComplete };
    }, { maxWait: 10000, timeout: 60000 });
    return NextResponse.json({ ok: true, data: { status: "verified", ...result } });
  } catch (error) {
    console.error("Order archive migration runner failed", error);
    return NextResponse.json({ ok: false, error: "Order migration မအောင်မြင်ပါ။ Database ကို ထပ်မပြောင်းဘဲ စစ်ဆေးရန်လိုပါသည်။" }, { status: 500 });
  }
}
