import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { decodeActorHeader } from "@/lib/actor-header";

const cleanAmount = (value) => {
  const amount = Number(String(value ?? "").replace(/,/g, "").trim());
  if (!Number.isInteger(amount) || amount < 0) throw new Error("ငွေပမာဏကို မှန်ကန်စွာ ထည့်ပါ။");
  return amount;
};
const AUGUST_FOOD_EXPENSES = [
  { expenseDate: "2026-08-31", category: "စားသောက်စာရိတ်", description: "ဆန် ၉ အိတ်နှင့် ၈ ပြည်", amount: 1359375 },
  { expenseDate: "2026-08-31", category: "စားသောက်စာရိတ်", description: "ဟင်းချက်ဆီ ၂၅ ပိဿာ ၅၀သား", amount: 499800 },
  { expenseDate: "2026-08-31", category: "စားသောက်စာရိတ်", description: "အသား", amount: 1817500 },
  { expenseDate: "2026-08-31", category: "စားသောက်စာရိတ်", description: "အသီးအရွက်နှင့် ဟင်းထဲထည့်သည့် အစာပလာဘိုး", amount: 1713000 },
];
export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    let rows = await prisma.expense.findMany({ where: month ? { expenseDate: { startsWith: month } } : undefined, orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }] });
    if (month === "2026-08") {
      const hasCorrectBase = AUGUST_FOOD_EXPENSES.every((item) => rows.some((row) => row.description === item.description && Number(row.amount) === item.amount));
      if (!hasCorrectBase) {
        await prisma.$transaction(async (tx) => {
          await tx.expense.deleteMany({ where: { expenseDate: { startsWith: "2026-08" } } });
          await Promise.all(AUGUST_FOOD_EXPENSES.map((item) => tx.expense.create({ data: { ...item, actorName: "system" } })));
        });
        rows = await prisma.expense.findMany({ where: { expenseDate: { startsWith: "2026-08" } }, orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }] });
      }
    }
    return NextResponse.json({ data: rows });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 500 }); }
}
export async function POST(request) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const actorName = decodeActorHeader(request.headers.get("x-actor-name")) || "system";
    if (body.replaceAugustFood === true) {
      const data = await prisma.$transaction(async (tx) => {
        await tx.expense.deleteMany({ where: { expenseDate: { startsWith: "2026-08" } } });
        return Promise.all(AUGUST_FOOD_EXPENSES.map((item) => tx.expense.create({ data: { ...item, actorName } })));
      });
      return NextResponse.json({ data, repaired: true }, { status: 201 });
    }
    const description = String(body.description || "").trim();
    if (!description) throw new Error("အသုံးစားရိတ်အမည် ထည့်ပါ။");
    const expense = await prisma.expense.create({ data: { expenseDate: String(body.expenseDate || new Date().toISOString().slice(0, 10)), category: String(body.category || "စားသောက်စာရိတ်").trim(), description, amount: cleanAmount(body.amount), note: String(body.note || "").trim() || null, actorName } });
    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 400 }); }
}
export async function DELETE(request) {
  try { await ensureDatabase(); const id = new URL(request.url).searchParams.get("id"); if (!id) throw new Error("Expense id မရှိပါ။"); const data = await prisma.expense.delete({ where: { id } }); return NextResponse.json({ data }); }
  catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 400 }); }
}
