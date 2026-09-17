import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { decodeActorHeader } from "@/lib/actor-header";

const parseAmount = (value) => Number(String(value || "").replace(/,/g, ""));

export async function GET(request) {
  try {
    await ensureDatabase();
    const customerId = new URL(request.url).searchParams.get("customerId");
    if (!customerId) throw new Error("customerId မရှိပါ။");
    const data = await prisma.outsideLedgerSettlement.findMany({ where: { customerId }, orderBy: { settledAt: "desc" } });
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 400 }); }
}

async function syncCustomerMarker(tx, customerId) {
  const latest = await tx.outsideLedgerSettlement.findFirst({ where: { customerId }, orderBy: { settledAt: "desc" } });
  await tx.customer.update({ where: { id: customerId }, data: latest ? { settledOutsideLedgerAt: latest.settledAt, settledOutsideLedgerBy: latest.actorName } : { settledOutsideLedgerAt: null, settledOutsideLedgerBy: null } });
}

export async function POST(request) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const amount = parseAmount(body.amount);
    if (!body.customerId || !Number.isInteger(amount) || amount <= 0) throw new Error("ငွေချေတဲ့ ပမာဏကို မှန်ကန်စွာ ထည့်ပါ။");
    const existing = await prisma.outsideLedgerSettlement.findFirst({ where: { customerId: body.customerId, amount, ledgerId: body.ledgerId || null }, orderBy: { settledAt: "desc" } });
    if (existing) return NextResponse.json({ error: "အလားတူ မြေပြင်ငွေချေမှတ်တမ်း ရှိပြီးသားပါ။ အဟောင်းမှတ်တမ်းကို ပြင်ပါ သို့မဟုတ် ဖျက်ပြီးမှ အသစ်ထည့်ပါ။", code: "DUPLICATE_OUTSIDE_SETTLEMENT", existing }, { status: 409 });
    const actorName = decodeActorHeader(request.headers.get("x-actor-name")) || "system";
    const data = await prisma.$transaction(async (tx) => {
      const settlement = await tx.outsideLedgerSettlement.create({ data: { customerId: body.customerId, ledgerId: body.ledgerId || null, amount, paymentMethod: String(body.paymentMethod || "ငွေသား"), note: String(body.note || "").trim() || null, actorName } });
      await syncCustomerMarker(tx, body.customerId);
      return settlement;
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 400 }); }
}

export async function PATCH(request) {
  try {
    await ensureDatabase();
    const id = new URL(request.url).searchParams.get("id");
    const body = await request.json();
    const amount = parseAmount(body.amount);
    if (!id || !Number.isInteger(amount) || amount <= 0) throw new Error("မြေပြင်ငွေချေမှတ်တမ်းကို မှန်ကန်စွာ ဖြည့်ပါ။");
    const data = await prisma.$transaction(async (tx) => {
      const current = await tx.outsideLedgerSettlement.findUnique({ where: { id } });
      if (!current) throw new Error("Settlement မတွေ့ပါ။");
      const duplicate = await tx.outsideLedgerSettlement.findFirst({ where: { customerId: current.customerId, amount, ledgerId: body.ledgerId || null, id: { not: id } } });
      if (duplicate) throw new Error("အလားတူ မြေပြင်ငွေချေမှတ်တမ်း ရှိပြီးသားပါ။");
      const updated = await tx.outsideLedgerSettlement.update({ where: { id }, data: { amount, ledgerId: body.ledgerId || null, paymentMethod: String(body.paymentMethod || "ငွေသား"), note: String(body.note || "").trim() || null } });
      await syncCustomerMarker(tx, current.customerId);
      return updated;
    });
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 400 }); }
}

export async function DELETE(request) {
  try {
    await ensureDatabase();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Settlement id မရှိပါ။");
    const data = await prisma.$transaction(async (tx) => {
      const settlement = await tx.outsideLedgerSettlement.delete({ where: { id } });
      await syncCustomerMarker(tx, settlement.customerId);
      return settlement;
    });
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 400 }); }
}
