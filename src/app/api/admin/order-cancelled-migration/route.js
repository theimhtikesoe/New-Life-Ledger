import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

const ALTER_SQL = `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT`;
const INDEX_SQL = `CREATE INDEX IF NOT EXISTS "Order_cancelledAt_idx" ON "Order"("cancelledAt")`;

async function run(request) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized migration request" }, { status: 401 });
  try {
    await ensureDatabase();
    await prisma.$executeRawUnsafe(ALTER_SQL);
    await prisma.$executeRawUnsafe(INDEX_SQL);
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'Order'
        AND column_name IN ('cancelledAt', 'cancelledBy')
      ORDER BY column_name ASC
    `);
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'Order'
        AND indexname = 'Order_cancelledAt_idx'
    `);
    const [orders, customers, ledger] = await Promise.all([
      prisma.order.count(),
      prisma.customer.count(),
      prisma.ledger.count(),
    ]);
    return NextResponse.json({
      ok: true,
      migration: "cancelled-order-metadata",
      columns: columns.map((row) => row.column_name),
      indexes: indexes.map((row) => row.indexname),
      counts: { orders, customers, ledger },
    });
  } catch (error) {
    console.error("Cancelled metadata migration failed", error);
    return NextResponse.json({ ok: false, error: "Cancelled metadata migration မအောင်မြင်ပါ။" }, { status: 500 });
  }
}

export async function GET(request) {
  return run(request);
}

export async function POST(request) {
  return run(request);
}
