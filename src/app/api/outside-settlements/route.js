import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { decodeActorHeader } from "@/lib/actor-header";

export async function GET(request) {
  try {
    await ensureDatabase();
    const customerId = new URL(request.url).searchParams.get("customerId");
    if (!customerId) throw new Error("customerId မရှိပါ။");
    const data = await prisma.outsideLedgerSettlement.findMany({ where: { customerId }, orderBy: { settledAt: "desc" } });
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 400 }); }
}

export async function POST(request) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const amount = Number(String(body.amount || "").replace(/,/g, ""));
    if (!body.customerId || !Number.isInteger(amount) || amount <= 0) throw new Error("ငွေချေတဲ့ ပမာဏကို မှန်ကန်စွာ ထည့်ပါ။");
    const actorName = decodeActorHeader(request.headers.get("x-actor-name")) || "system";
    const data = await prisma.$transaction(async (tx) => {
      const settlement = await tx.outsideLedgerSettlement.create({ data: { customerId: body.customerId, ledgerId: body.ledgerId || null, amount, paymentMethod: String(body.paymentMethod || "ငွေသား"), note: String(body.note || "").trim() || null, actorName } });
      await tx.customer.update({ where: { id: body.customerId }, data: { settledOutsideLedgerAt: settlement.settledAt, settledOutsideLedgerBy: settlement.actorName } });
      return settlement;
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 400 }); }
}

export async function DELETE(request) {
  try {
    await ensureDatabase();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Settlement id မရှိပါ။");
    const data = await prisma.$transaction(async (tx) => {
      const settlement = await tx.outsideLedgerSettlement.delete({ where: { id } });
      const latest = await tx.outsideLedgerSettlement.findFirst({ where: { customerId: settlement.customerId }, orderBy: { settledAt: "desc" } });
      await tx.customer.update({ where: { id: settlement.customerId }, data: latest ? { settledOutsideLedgerAt: latest.settledAt, settledOutsideLedgerBy: latest.actorName } : { settledOutsideLedgerAt: null, settledOutsideLedgerBy: null } });
      return settlement;
    });
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 400 }); }
}
