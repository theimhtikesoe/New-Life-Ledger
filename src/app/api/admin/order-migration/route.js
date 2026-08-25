import { NextResponse } from "next/server";
import { requireDatabaseUrl } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { ORDER_MIGRATION_STATEMENTS } from "@/lib/order-migration-sql";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_TABLES = ["Order", "OrderLine", "OrderCap", "OrderDelivery", "OrderAutomationSetting", "OrderBatchRun"];

async function tableNames(client) {
  const rows = await client.$queryRawUnsafe(
    `SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (${ORDER_TABLES.map((name) => `'${name}'`).join(", ")}) ORDER BY table_name`,
  );
  return rows.map((row) => String(row.tableName));
}

async function baseTableCheck(client) {
  const rows = await client.$queryRawUnsafe(
    `SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('Customer', 'Ledger') ORDER BY table_name`,
  );
  return rows.map((row) => String(row.tableName));
}

async function ledgerCounts(client) {
  const rows = await client.$queryRawUnsafe(
    `SELECT (SELECT count(*) FROM "Customer")::text AS "customerCount", (SELECT count(*) FROM "Ledger")::text AS "ledgerCount"`,
  );
  return { customerCount: String(rows[0]?.customerCount ?? ""), ledgerCount: String(rows[0]?.ledgerCount ?? "") };
}

export async function POST() {
  try {
    requireDatabaseUrl();
    const baseTables = await baseTableCheck(prisma);
    if (!baseTables.includes("Customer") || !baseTables.includes("Ledger")) {
      return NextResponse.json({ ok: false, error: "အခြေခံ Customer/Ledger table မပြည့်စုံသေးပါ။ Migration ကို မလုပ်ပါ။" }, { status: 409 });
    }

    const existingOrderTables = await tableNames(prisma);
    if (existingOrderTables.length) {
      return NextResponse.json({ ok: false, error: "Order table တစ်ခုခု ရှိပြီးသားဖြစ်သောကြောင့် ထပ်မလုပ်ဘဲ manual review လိုပါသည်။", existingOrderTables }, { status: 409 });
    }

    const before = await ledgerCounts(prisma);
    const result = await prisma.$transaction(async (tx) => {
      for (const statement of ORDER_MIGRATION_STATEMENTS) {
        await tx.$executeRawUnsafe(statement);
      }
      const after = await ledgerCounts(tx);
      const createdTables = await tableNames(tx);
      const expectedTablesPresent = ORDER_TABLES.every((name) => createdTables.includes(name));
      const ledgerDataUnchanged = before.customerCount === after.customerCount && before.ledgerCount === after.ledgerCount;
      if (!expectedTablesPresent || !ledgerDataUnchanged) {
        throw new Error("Order migration verification failed");
      }
      return { createdTables, customerLedgerRowsUnchanged: true };
    }, { maxWait: 10000, timeout: 60000 });

    return NextResponse.json({ ok: true, data: { status: "created", ...result } });
  } catch (error) {
    console.error("Order migration runner failed", error);
    return NextResponse.json({ ok: false, error: "Order migration မအောင်မြင်ပါ။ Database ကို ထပ်မပြောင်းဘဲ စစ်ဆေးရန်လိုပါသည်။" }, { status: 500 });
  }
}
