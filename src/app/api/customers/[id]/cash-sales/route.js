import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const cashSaleSelect = {
  id: true,
  date: true,
  saleType: true,
  itemSize: true,
  cartons: true,
  rate: true,
  deductions: true,
  amount: true,
  note: true,
  paymentType: true,
  createdAt: true,
};

function parseAmount(value) {
  const amount = Math.round(Number(value || 0));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("လက်ငင်းရောင်းပမာဏသည် ၀ ထက်ကြီးရပါမည်။");
  return amount;
}

function parseOptionalInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  if (!value) return new Date();
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("ရက်စွဲပုံစံ မမှန်ပါ။");
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("ရက်စွဲပုံစံ မမှန်ပါ။");
  return date;
}

export async function GET(request, { params }) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") || 50);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 50, 1), 100);
    const requestedOffset = Number(searchParams.get("offset") || 0);
    const offset = Math.max(Number.isFinite(requestedOffset) ? Math.floor(requestedOffset) : 0, 0);
    const date = {};
    if (searchParams.get("startDate")) date.gte = new Date(`${searchParams.get("startDate")}T00:00:00.000Z`);
    if (searchParams.get("endDate")) date.lt = new Date(`${searchParams.get("endDate")}T00:00:00.000Z`);
    const where = { customerId: params.id, ...(Object.keys(date).length ? { date } : {}) };
    const [items, total] = await Promise.all([
      prisma.cashSale.findMany({ where, select: cashSaleSelect, orderBy: [{ date: "desc" }, { id: "desc" }], skip: offset, take: limit }),
      prisma.cashSale.count({ where }),
    ]);
    return NextResponse.json({ data: { items, pagination: { offset, limit, total, hasMore: offset + items.length < total } } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const amount = parseAmount(body.amount);
    const date = parseDate(body.date);
    const customer = await prisma.customer.findUnique({ where: { id: params.id }, select: { id: true, name: true, deletedAt: true } });
    if (!customer || customer.deletedAt) return NextResponse.json({ error: "Customer မတွေ့ပါ သို့မဟုတ် Recycle Bin ထဲ ရှိနေပါသည်။" }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const cashSale = await tx.cashSale.create({
        data: {
          customerId: customer.id,
          saleType: String(body.saleType || "RETAIL").trim() || "RETAIL",
          itemSize: body.itemSize?.trim() || null,
          cartons: parseOptionalInteger(body.cartons),
          rate: parseOptionalInteger(body.rate),
          deductions: parseOptionalInteger(body.deductions) || 0,
          amount,
          note: body.note?.trim() || null,
          paymentType: body.paymentType?.trim() || "CASH",
          date,
        },
        select: cashSaleSelect,
      });
      await writeAuditLog({
        db: tx,
        actorName: getActorName(request),
        action: "CASH_SALE",
        entityType: "CashSale",
        entityId: cashSale.id,
        entityLabel: customer.name,
        summary: `${customer.name} လက်ငင်းရောင်း ${amount.toLocaleString()} Ks`,
        metadata: { customerId: customer.id, amount, paymentType: cashSale.paymentType, note: cashSale.note, date: cashSale.date },
      });
      return { cashSale };
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: error.message?.includes("ပမာဏ") || error.message?.includes("ရက်စွဲ") ? 400 : 500 });
  }
}
