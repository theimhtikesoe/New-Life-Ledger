import { NextResponse } from "next/server";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { aggregateStockMovements, ensureFactoryStockTable, productionMovementRows, saleMovementRows } from "@/lib/factory-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateFilter(searchParams) {
  const movementDate = {};
  const from = String(searchParams.get("from") || "").trim();
  const to = String(searchParams.get("to") || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) movementDate.gte = from;
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) movementDate.lte = to;
  return Object.keys(movementDate).length ? { movementDate } : {};
}

export async function GET(request) {
  try {
    await ensureDatabase();
    await ensureFactoryStockTable();
    const { searchParams } = new URL(request.url);
    const productKey = String(searchParams.get("productKey") || "").trim();
    const movements = await prisma.factoryStockMovement.findMany({
      where: { ...dateFilter(searchParams), ...(productKey ? { productKey } : {}) },
      orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    const summary = aggregateStockMovements(movements);
    return NextResponse.json({ data: {
      calculationMode: "DATABASE_DERIVED",
      isPhysicalVerified: false,
      summary,
      movements,
      warnings: ["ဤလက်ကျန်သည် Database မှတွက်ထားသော System Stock ဖြစ်ပြီး မြေပြင်လက်ကျန်နှင့် ကွာနိုင်ပါသည်။"],
    } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureDatabase();
    await ensureFactoryStockTable();
    const actorName = getActorName(request);
    const body = await request.json().catch(() => ({}));
    if (body.action !== "rebuild") return NextResponse.json({ error: "Factory Stock API action မမှန်ပါ။" }, { status: 400 });

    const [productionRows, ledgerRows, cashSales] = await Promise.all([
      prisma.productionReport.findMany({ select: { reportDate: true, category: true, outputQuantity: true, outputCapacity: true, bottleType: true, submissionId: true, notes: true, actorName: true }, orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }] }),
      prisma.ledger.findMany({ where: { saleItems: { not: null } }, select: { id: true, date: true, saleItems: true }, orderBy: [{ date: "asc" }, { id: "asc" }] }),
      prisma.cashSale.findMany({ where: { saleItems: { not: null } }, select: { id: true, date: true, saleItems: true }, orderBy: [{ date: "asc" }, { id: "asc" }] }),
    ]);
    const productionMovements = productionMovementRows(productionRows, { actorName });
    const ledgerMovements = saleMovementRows(ledgerRows, { actorName, sourceType: "LEDGER" });
    const cashMovements = saleMovementRows(cashSales, { actorName, sourceType: "CASH_SALE" });
    const movements = [...productionMovements, ...ledgerMovements, ...cashMovements];

    const result = await prisma.$transaction(async (tx) => {
      await tx.factoryStockMovement.deleteMany({ where: { sourceType: { in: ["PRODUCTION", "LEDGER", "CASH_SALE"] } } });
      if (movements.length) await tx.factoryStockMovement.createMany({ data: movements });
      await writeAuditLog({
        db: tx,
        actorName,
        action: "FACTORY_STOCK_REBUILD",
        entityType: "FactoryStockMovement",
        entityId: null,
        entityLabel: "Factory Stock",
        summary: `Factory Stock rebuild ပြီးစီး (${movements.length} movements)`,
        metadata: { productionRows: productionMovements.length, ledgerRows: ledgerMovements.length, cashSaleRows: cashMovements.length, movementCount: movements.length },
      });
      return { movementCount: movements.length };
    });
    return NextResponse.json({ data: { ...result, calculationMode: "DATABASE_DERIVED", isPhysicalVerified: false } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
