import { NextResponse } from "next/server";
import { requestHasValidSession } from "@/lib/auth-session";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "AiExplanationCache" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reportDate" TEXT NOT NULL,
  "dataFingerprint" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL DEFAULT 'v2',
  "explanation" JSONB NOT NULL,
  "generatedBy" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiExplanationCache_pkey" PRIMARY KEY ("id")
)`;
const UNIQUE_INDEX_SQL = `CREATE UNIQUE INDEX IF NOT EXISTS "AiExplanationCache_reportDate_dataFingerprint_promptVersion_key" ON "AiExplanationCache" ("reportDate", "dataFingerprint", "promptVersion")`;
const DATE_INDEX_SQL = `CREATE INDEX IF NOT EXISTS "AiExplanationCache_reportDate_idx" ON "AiExplanationCache" ("reportDate")`;
const UPDATED_INDEX_SQL = `CREATE INDEX IF NOT EXISTS "AiExplanationCache_reportDate_updatedAt_idx" ON "AiExplanationCache" ("reportDate", "updatedAt")`;

async function dataSnapshot() {
  const [orders, customers, ledger, customerBalance, ledgerAmount] = await Promise.all([
    prisma.order.count(),
    prisma.customer.count(),
    prisma.ledger.count(),
    prisma.customer.aggregate({ _sum: { current_balance: true } }),
    prisma.ledger.aggregate({ _sum: { amount: true } }),
  ]);
  return {
    orders,
    customers,
    ledger,
    customerBalanceTotal: customerBalance._sum.current_balance || 0,
    ledgerAmountTotal: ledgerAmount._sum.amount || 0,
  };
}

async function run(request) {
  if (!(await requestHasValidSession(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized migration request" }, { status: 401 });
  }

  try {
    await ensureDatabase();
    const before = await dataSnapshot();
    await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
    await prisma.$executeRawUnsafe(UNIQUE_INDEX_SQL);
    await prisma.$executeRawUnsafe(DATE_INDEX_SQL);
    await prisma.$executeRawUnsafe(UPDATED_INDEX_SQL);

    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'AiExplanationCache'
      ORDER BY ordinal_position ASC
    `);
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'AiExplanationCache'
      ORDER BY indexname ASC
    `);
    const after = await dataSnapshot();
    const expectedColumns = ["id", "reportDate", "dataFingerprint", "promptVersion", "explanation", "generatedBy", "provider", "model", "createdAt", "updatedAt"];
    const expectedIndexes = [
      "AiExplanationCache_pkey",
      "AiExplanationCache_reportDate_dataFingerprint_promptVersion_key",
      "AiExplanationCache_reportDate_idx",
      "AiExplanationCache_reportDate_updatedAt_idx",
    ];
    const actualColumns = columns.map((row) => row.column_name);
    const actualIndexes = indexes.map((row) => row.indexname);
    const unchanged = JSON.stringify(before) === JSON.stringify(after);
    const schemaVerified = expectedColumns.every((name) => actualColumns.includes(name)) && expectedIndexes.every((name) => actualIndexes.includes(name));

    return NextResponse.json({
      ok: unchanged && schemaVerified,
      migration: "ai-explanation-cache",
      schemaVerified,
      dataUnchanged: unchanged,
      columns: actualColumns,
      indexes: actualIndexes,
      before,
      after,
    }, { status: unchanged && schemaVerified ? 200 : 500 });
  } catch (error) {
    console.error("AI explanation cache migration failed", error);
    return NextResponse.json({ ok: false, error: "AI explanation cache migration မအောင်မြင်ပါ။" }, { status: 500 });
  }
}

export async function GET(request) {
  return run(request);
}

export async function POST(request) {
  return run(request);
}
