import { NextResponse } from "next/server";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { aggregateStockMovements, ensureFactoryStockTable, loadDerivedFactoryStockMovements, productionMovementRows, saleMovementRows, STOCK_TYPES } from "@/lib/factory-stock";

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
    let movements = await prisma.factoryStockMovement.findMany({
      where: { ...dateFilter(searchParams), ...(productKey ? { productKey } : {}) },
      orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    let dataSource = "MOVEMENT_LEDGER";
    if (!productKey && !Object.keys(dateFilter(searchParams)).length) {
      const derived = await loadDerivedFactoryStockMovements({ actorName: getActorName(request) });
      const hasTubeLedger = movements.some((movement) => movement.stockType === STOCK_TYPES.TUBE);
      const hasBottleLedger = movements.some((movement) => movement.stockType !== STOCK_TYPES.TUBE);
      if (!movements.length) {
        movements = derived;
        dataSource = "LIVE_DERIVED_FALLBACK";
      } else {
        const missingMovements = [
          ...(hasBottleLedger ? [] : derived.filter((movement) => movement.stockType !== STOCK_TYPES.TUBE)),
          ...(hasTubeLedger ? [] : derived.filter((movement) => movement.stockType === STOCK_TYPES.TUBE)),
        ];
        if (missingMovements.length) {
          movements = [...movements, ...missingMovements];
          dataSource = "MOVEMENT_LEDGER_PLUS_DERIVED_STOCK";
        }
      }
    }
    const summary = aggregateStockMovements(movements);
    return NextResponse.json({ data: {
      calculationMode: "DATABASE_DERIVED",
      isPhysicalVerified: false,
      dataSource,
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

    const movements = await loadDerivedFactoryStockMovements({ actorName });
    const productionMovements = movements.filter((movement) => ["PRODUCTION", "TUBE_PRODUCTION", "BOTTLE_PRODUCTION"].includes(movement.sourceType));
    const ledgerMovements = movements.filter((movement) => movement.sourceType === "LEDGER");
    const cashMovements = movements.filter((movement) => movement.sourceType === "CASH_SALE");

    const result = await prisma.$transaction(async (tx) => {
      await tx.factoryStockMovement.deleteMany({ where: { sourceType: { in: ["PRODUCTION", "TUBE_PRODUCTION", "BOTTLE_PRODUCTION", "LEDGER", "CASH_SALE"] } } });
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
