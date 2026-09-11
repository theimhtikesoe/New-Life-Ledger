import { NextResponse } from "next/server";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { aggregateStockMovements, ensureFactoryStockTable, loadCanonicalFactoryStockMovements, productionMovementRows, saleMovementRows, MOVEMENT_TYPES, STOCK_TYPES } from "@/lib/factory-stock";
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
    const requestedStockType = String(searchParams.get("stockType") || "").trim().toUpperCase();
    const canonical = !productKey && !Object.keys(dateFilter(searchParams)).length
      ? await loadCanonicalFactoryStockMovements({ actorName: getActorName(request) })
      : { movements: await prisma.factoryStockMovement.findMany({
        where: { ...dateFilter(searchParams), ...(productKey ? { productKey } : {}) },
        orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }), dataSource: "MOVEMENT_LEDGER" };
    let movements = requestedStockType ? canonical.movements.filter((movement) => movement.stockType === requestedStockType) : canonical.movements;
    const dataSource = canonical.dataSource;
    const summary = aggregateStockMovements(movements);
    const summaryByKey = new Map(summary.map((item) => [item.productKey, item]));
    // Factory Stock is an Item-level inventory view. Include every bottle Item
    // configured in Price Settings even when it has no production or sale
    // movement yet, so the table is a complete catalog rather than a movement
    // history filtered down to only active products.
    for (const item of buildCatalog().filter((entry) => entry.productType === "bottle" && (!requestedStockType || requestedStockType === STOCK_TYPES.BOTTLE))) {
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
          systemCurrentCards: 0,
          systemCurrentBottles: 0,
          openingStockCards: 0,
          openingStockBottles: 0,
          unrecordedOpeningStockCards: 0,
          unrecordedOpeningStockBottles: 0,
          currentBottles: 0,
        });
      }
    }
    for (const item of buildCatalog().filter((entry) => entry.productType === "cap" && (!requestedStockType || requestedStockType === STOCK_TYPES.CAP))) {
      if (!summaryByKey.has(item.productKey)) {
        summary.push({ productKey: item.productKey, stockType: STOCK_TYPES.CAP, productName: item.productName, capacity: 0, productionCards: 0, soldCards: 0, adjustmentCards: 0, currentCards: 0, productionBottles: 0, soldBottles: 0, usedBottles: 0, usedCards: 0, adjustmentBottles: 0, wastedBottles: 0, systemCurrentCards: 0, systemCurrentBottles: 0, openingStockCards: 0, openingStockBottles: 0, unrecordedOpeningStockCards: 0, unrecordedOpeningStockBottles: 0, currentBottles: 0 });
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
    if (body.action === "addCapStock") {
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const batchId = `CAP_STOCK_${crypto.randomUUID()}`;
      const movements = rows.map((row) => {
        const location = String(row.location || "").trim();
        const color = String(row.color || "").trim();
        const packSize = Math.round(Number(row.packSize || 0));
        const packs = Math.round(Number(row.packs || 0));
        if (!location || !color || !Number.isFinite(packSize) || packSize <= 0 || !Number.isFinite(packs) || packs <= 0) return null;
        return { movementDate: String(body.date || new Date().toISOString().slice(0, 10)), movementType: MOVEMENT_TYPES.ADJUSTMENT_IN, stockType: STOCK_TYPES.CAP, productKey: `CAP::${location}::${color}::${packSize}`, productName: `${location} · ${color}`, capacity: packSize, quantityCards: packs, quantityBottles: packs * packSize, sourceType: "CAP_OPENING", sourceId: batchId, sourceVersion: "cap-opening-v1", reason: "အဖုံး လက်ရှိ/အသစ်ဝင် Stock ထည့်ခြင်း", note: String(row.note || "").trim() || null, actorName };
      }).filter(Boolean);
      if (!movements.length) return NextResponse.json({ error: "နေရာ၊ အဖုံးအရောင်၊ တစ်အိတ်ဆံ့နှင့် အိတ်အရေအတွက် မှန်ကန်စွာထည့်ပါ။" }, { status: 400 });
      await prisma.factoryStockMovement.createMany({ data: movements });
      await writeAuditLog({ db: prisma, actorName, action: "CAP_STOCK_ADD", entityType: "FactoryStockMovement", entityId: batchId, entityLabel: "Cap Stock", summary: `အဖုံး Stock ${movements.length} မျိုး ထည့်သွင်း`, metadata: { movementCount: movements.length } });
      return NextResponse.json({ data: { batchId, movementCount: movements.length } });
    }
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
