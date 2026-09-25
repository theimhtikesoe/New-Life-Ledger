import { NextResponse } from "next/server";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { ensureFactoryStockTable } from "@/lib/factory-stock";
import { glueStockAddition, loadGlueStock, GLUE_STOCK_TYPE, invalidateFactoryStockCache } from "@/lib/glue-stock";
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || getMyanmarDateInputValue();
    return NextResponse.json({ data: await loadGlueStock({ date, includeMovements: true }) });
  } catch (error) {
    console.error("Glue stock read failed", error);
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureDatabase();
    await ensureFactoryStockTable();
    const body = await request.json().catch(() => ({}));
    const actorName = getActorName(request);
    const movement = glueStockAddition({ ...body, actorName });
    await prisma.factoryStockMovement.create({ data: movement });
    await writeAuditLog({ db: prisma, actorName, action: "GLUE_STOCK_ADD", entityType: "FactoryStockMovement", entityId: movement.sourceId, entityLabel: "စက်ရုံ ကော်စေ့ လက်ကျန်", summary: `ကော်စေ့ ${movement.quantityBottles} kg / ${movement.quantityCards} အိတ် ထည့်သွင်း`, metadata: { date: movement.movementDate, kg: movement.quantityBottles, bags: movement.quantityCards } });
    await prisma.dashboardKpiSnapshot.deleteMany({ where: { date: movement.movementDate } });
    invalidateFactoryStockCache();
    return NextResponse.json({ data: { sourceId: movement.sourceId } }, { status: 201 });
  } catch (error) {
    console.error("Glue stock write failed", error);
    return NextResponse.json(databaseErrorResponse(error), { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    await ensureDatabase();
    await ensureFactoryStockTable();
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    const existing = await prisma.factoryStockMovement.findFirst({ where: { id, stockType: GLUE_STOCK_TYPE, sourceType: "GLUE_OPENING" } });
    if (!existing) return NextResponse.json({ error: "Manual ကော်စေ့ Stock မှတ်တမ်း မတွေ့ပါ။" }, { status: 404 });
    const updated = glueStockAddition({ date: body.date || existing.movementDate, kg: body.kg, bags: body.bags, note: body.note, actorName: getActorName(request) });
    await prisma.factoryStockMovement.update({ where: { id }, data: { movementDate: updated.movementDate, quantityBottles: updated.quantityBottles, quantityCards: updated.quantityCards, note: updated.note, actorName: updated.actorName } });
    await writeAuditLog({ db: prisma, actorName: getActorName(request), action: "GLUE_STOCK_UPDATE", entityType: "FactoryStockMovement", entityId: id, entityLabel: "စက်ရုံ ကော်စေ့ လက်ကျန်", summary: "ကော်စေ့ Stock မှတ်တမ်း ပြင်ဆင်", metadata: { kg: updated.quantityBottles, bags: updated.quantityCards } });
    invalidateFactoryStockCache();
    return NextResponse.json({ data: { id, updated: true } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    await ensureDatabase();
    await ensureFactoryStockTable();
    const id = new URL(request.url).searchParams.get("id");
    const existing = await prisma.factoryStockMovement.findFirst({ where: { id, stockType: GLUE_STOCK_TYPE, sourceType: "GLUE_OPENING" } });
    if (!existing) return NextResponse.json({ error: "Manual ကော်စေ့ Stock မှတ်တမ်း မတွေ့ပါ။" }, { status: 404 });
    await prisma.factoryStockMovement.delete({ where: { id } });
    await writeAuditLog({ db: prisma, actorName: getActorName(request), action: "GLUE_STOCK_DELETE", entityType: "FactoryStockMovement", entityId: id, entityLabel: "စက်ရုံ ကော်စေ့ လက်ကျန်", summary: "ကော်စေ့ Stock မှတ်တမ်း ဖျက်", metadata: { kg: existing.quantityBottles, bags: existing.quantityCards } });
    invalidateFactoryStockCache();
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 400 });
  }
}
