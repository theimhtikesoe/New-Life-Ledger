import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export async function GET() {
  try {
    await ensureDatabase();
    const data = await prisma.productionWorker.findMany({ where: { active: true }, orderBy: [{ name: "asc" }] });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Production workers read failed", error);
    return NextResponse.json({ error: error.message || "Worker စာရင်း ရယူ၍မရပါ။" }, { status: 400 });
  }
}

export async function POST(request) {
  try {
    await ensureDatabase();
    const name = normalizeName((await request.json()).name);
    if (!name) throw new Error("Worker နာမည်ထည့်ပေးပါ။");
    if (name.length > 80) throw new Error("Worker နာမည်သည် စာလုံး ၈၀ ထက် မကျော်ရပါ။");
    const worker = await prisma.productionWorker.upsert({
      where: { name },
      update: { active: true },
      create: { name },
    });
    const actorName = getActorName(request);
    await writeAuditLog({ actorName, action: "PRODUCTION_WORKER_CREATE", entityType: "ProductionWorker", entityId: worker.id, entityLabel: name, summary: `Production Worker ထည့်သွင်း (${name})` });
    return NextResponse.json({ data: worker }, { status: 201 });
  } catch (error) {
    console.error("Production worker create failed", error);
    return NextResponse.json({ error: error.message || "Worker ထည့်၍မရပါ။" }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    await ensureDatabase();
    const id = String(new URL(request.url).searchParams.get("id") || "").trim();
    const name = normalizeName(new URL(request.url).searchParams.get("name"));
    if (!id && !name) throw new Error("ဖျက်မည့် Worker မတွေ့ပါ။");
    const worker = await prisma.productionWorker.findFirst({ where: id ? { id } : { name } });
    if (!worker) throw new Error("ဖျက်မည့် Worker မတွေ့ပါ။");
    await prisma.productionWorker.update({ where: { id: worker.id }, data: { active: false } });
    const actorName = getActorName(request);
    await writeAuditLog({ actorName, action: "PRODUCTION_WORKER_DELETE", entityType: "ProductionWorker", entityId: worker.id, entityLabel: worker.name, summary: `Production Worker ဖယ်ရှား (${worker.name})` });
    return NextResponse.json({ data: { id: worker.id, name: worker.name } });
  } catch (error) {
    console.error("Production worker delete failed", error);
    return NextResponse.json({ error: error.message || "Worker ဖယ်၍မရပါ။" }, { status: 400 });
  }
}
