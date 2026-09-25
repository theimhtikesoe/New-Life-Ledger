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
    await writeAuditLog({ db: prisma, actorName: getActorName(request), action: "PACKAGING_BAG_STOCK_ADD", entityType: "FactoryStockMovement", entityId: movement.sourceId, entityLabel: movement.productName, summary: `${movement.productName} ${movement.quantityBottles} လုံး ထည့်သွင်း`, metadata: { bagSize: body.bagSize, pieces: movement.quantityBottles, date: movement.movementDate } });
    await prisma.dashboardKpiSnapshot.deleteMany({ where: { date: movement.movementDate } });
    invalidateFactoryStockCache();
    return NextResponse.json({ data: { sourceId: movement.sourceId, addedPieces: movement.quantityBottles } }, { status: 201 });
  } catch (error) {
    console.error("Packaging bag stock write failed", error);
    return NextResponse.json(databaseErrorResponse(error), { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    await ensureDatabase();
    await ensureFactoryStockTable();
    const actorName = getActorName(request);
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "ပြင်ရန် မှတ်တမ်း ID မရှိပါ။" }, { status: 400 });
    const existing = await prisma.factoryStockMovement.findFirst({ where: { id, stockType: "PACKAGING_BAG", movementType: "ADJUSTMENT_IN", sourceType: "PACKAGING_BAG_OPENING" } });
    if (!existing) return NextResponse.json({ error: "Manual အိတ်ခွံ Stock မှတ်တမ်း မတွေ့ပါ။ အလိုအလျောက်သုံးစွဲမှုကို တိုက်ရိုက်မပြင်နိုင်ပါ။" }, { status: 404 });
    const movement = packagingBagMovement({ ...body, date: body.date || existing.movementDate, actorName });
    const updated = await prisma.factoryStockMovement.update({ where: { id }, data: { movementDate: movement.movementDate, productKey: movement.productKey, productName: movement.productName, capacity: 1, quantityCards: movement.quantityCards, quantityBottles: movement.quantityBottles, sourceVersion: movement.sourceVersion, note: movement.note, actorName } });
    await writeAuditLog({ db: prisma, actorName, action: "PACKAGING_BAG_STOCK_UPDATE", entityType: "FactoryStockMovement", entityId: id, entityLabel: updated.productName, summary: `${updated.productName} Stock မှတ်တမ်း ပြင်ဆင်`, metadata: { bagSize: body.bagSize, pieces: movement.quantityBottles, date: movement.movementDate } });
    await prisma.dashboardKpiSnapshot.deleteMany({ where: { date: { in: [existing.movementDate, updated.movementDate] } } });
    invalidateFactoryStockCache();
    return NextResponse.json({ data: { id, updated: true } });
  } catch (error) {
    console.error("Packaging bag stock update failed", error);
    return NextResponse.json(databaseErrorResponse(error), { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    await ensureDatabase();
    await ensureFactoryStockTable();
    const actorName = getActorName(request);
    const id = String(new URL(request.url).searchParams.get("id") || "").trim();
    if (!id) return NextResponse.json({ error: "ဖျက်ရန် မှတ်တမ်း ID မရှိပါ။" }, { status: 400 });
    const existing = await prisma.factoryStockMovement.findFirst({ where: { id, stockType: "PACKAGING_BAG", movementType: "ADJUSTMENT_IN", sourceType: "PACKAGING_BAG_OPENING" } });
    if (!existing) return NextResponse.json({ error: "Manual အိတ်ခွံ Stock မှတ်တမ်း မတွေ့ပါ။ အလိုအလျောက်သုံးစွဲမှုကို တိုက်ရိုက်မဖျက်နိုင်ပါ။" }, { status: 404 });
    await prisma.factoryStockMovement.delete({ where: { id } });
    await writeAuditLog({ db: prisma, actorName, action: "PACKAGING_BAG_STOCK_DELETE", entityType: "FactoryStockMovement", entityId: id, entityLabel: existing.productName, summary: `${existing.productName} Stock မှတ်တမ်း ဖျက်`, metadata: { quantityPieces: existing.quantityBottles, date: existing.movementDate } });
    await prisma.dashboardKpiSnapshot.deleteMany({ where: { date: existing.movementDate } });
    invalidateFactoryStockCache();
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    console.error("Packaging bag stock delete failed", error);
    return NextResponse.json(databaseErrorResponse(error), { status: 400 });
  }
}
