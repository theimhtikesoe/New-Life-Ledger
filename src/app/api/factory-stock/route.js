import { NextResponse } from "next/server";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { aggregateStockMovements, ensureFactoryStockTable, loadDerivedFactoryStockMovements, productionMovementRows, saleMovementRows, STOCK_TYPES } from "@/lib/factory-stock";
import { buildCatalog } from "@/lib/production-catalog";

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
      const movementKey = (movement) => [
        movement.sourceType,
        movement.sourceId,
        movement.movementType,
        movement.productKey,
        movement.quantityCards,
        movement.quantityBottles,
      ].map((value) => String(value ?? "")).join("|");
      const existingKeys = new Set(movements.map(movementKey));
      const missingMovements = derived.filter((movement) => !existingKeys.has(movementKey(movement)));
      if (!movements.length) {
        movements = derived;
        dataSource = "LIVE_DERIVED_FALLBACK";
      } else if (missingMovements.length) {
        movements = [...movements, ...missingMovements];
        dataSource = "MOVEMENT_LEDGER_PLUS_DERIVED_STOCK";
      }
    }
    const summary = aggregateStockMovements(movements);
    const summaryByKey = new Map(summary.map((item) => [item.productKey, item]));
    // Factory Stock is an Item-level inventory view. Include every bottle Item
    // configured in Price Settings even when it has no production or sale
    // movement yet, so the table is a complete catalog rather than a movement
    // history filtered down to only active products.
    for (const item of buildCatalog().filter((entry) => entry.productType === "bottle")) {
      if (!summaryByKey.has(item.productKey)) {
        summary.push({
          productKey: item.productKey,
          stockType: STOCK_TYPES.BOTTLE,
          productName: item.productName,
          capacity: Number(item.capacity || 0),
          productionCards: 0,
          soldCards: 0,
          adjustmentCards: 0,
          currentCards: 0,
          productionBottles: 0,
          soldBottles: 0,
          usedBottles: 0,
          usedCards: 0,
          adjustmentBottles: 0,
          wastedBottles: 0,
          currentBottles: 0,
        });
      }
    }
    summary.sort((a, b) => a.productName.localeCompare(b.productName, "my") || Number(a.capacity || 0) - Number(b.capacity || 0));
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
