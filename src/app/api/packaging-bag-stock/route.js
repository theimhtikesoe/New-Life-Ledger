import { NextResponse } from "next/server";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { ensureFactoryStockTable, invalidateFactoryStockCache } from "@/lib/factory-stock";
import { loadPackagingBagStock, packagingBagMovement } from "@/lib/packaging-bag-stock";
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await ensureDatabase();
    await ensureFactoryStockTable();
    const date = new URL(request.url).searchParams.get("date") || getMyanmarDateInputValue();
    const data = await loadPackagingBagStock({ date, includeMovements: true });
    return NextResponse.json({ data: { ...data, usageDate: date } });
  } catch (error) {
    console.error("Packaging bag stock read failed", error);
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureDatabase();
    await ensureFactoryStockTable();
    const body = await request.json().catch(() => ({}));
    const movement = packagingBagMovement({ ...body, date: body.date || getMyanmarDateInputValue(), actorName: getActorName(request) });
    await prisma.factoryStockMovement.create({ data: movement });
    await writeAuditLog({ db: prisma, actorName: getActorName(request), action: "PACKAGING_BAG_STOCK_ADD", entityType: "FactoryStockMovement", entityId: movement.sourceId, entityLabel: movement.productName, summary: `${movement.productName} ${movement.quantityBottles} အိတ် ထည့်သွင်း`, metadata: { bagSize: body.bagSize, bags: movement.quantityBottles, date: movement.movementDate } });
    await prisma.dashboardKpiSnapshot.deleteMany({ where: { date: movement.movementDate } });
    invalidateFactoryStockCache();
    return NextResponse.json({ data: { sourceId: movement.sourceId, addedBags: movement.quantityBottles } }, { status: 201 });
  } catch (error) {
    console.error("Packaging bag stock write failed", error);
    return NextResponse.json(databaseErrorResponse(error), { status: 400 });
  }
}
