import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { decodeActorHeader } from "@/lib/actor-header";

const cleanAmount = (value) => {
  const amount = Number(String(value ?? "").replace(/,/g, "").trim());
  if (!Number.isInteger(amount) || amount < 0) throw new Error("ငွေပမာဏကို မှန်ကန်စွာ ထည့်ပါ။");
  return amount;
};
export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const rows = await prisma.expense.findMany({ where: month ? { expenseDate: { startsWith: month } } : undefined, orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }] });
    return NextResponse.json({ data: rows });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 500 }); }
}
export async function POST(request) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const description = String(body.description || "").trim();
    if (!description) throw new Error("အသုံးစားရိတ်အမည် ထည့်ပါ။");
    const expense = await prisma.expense.create({ data: { expenseDate: String(body.expenseDate || new Date().toISOString().slice(0, 10)), category: String(body.category || "စားသောက်စာရိတ်").trim(), description, amount: cleanAmount(body.amount), note: String(body.note || "").trim() || null, actorName: decodeActorHeader(request.headers.get("x-actor-name")) || "system" } });
    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 400 }); }
}
export async function DELETE(request) {
  try { await ensureDatabase(); const id = new URL(request.url).searchParams.get("id"); if (!id) throw new Error("Expense id မရှိပါ။"); const data = await prisma.expense.delete({ where: { id } }); return NextResponse.json({ data }); }
  catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 400 }); }
}
