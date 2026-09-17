import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { settlementTargetIds } from "@/lib/ledger-settlement";

export const dynamic = "force-dynamic";
const DAY_MS = 24 * 60 * 60 * 1000;
const day = (value) => new Date(value).toISOString().slice(0, 10);
const rounded = (value) => Math.round(Number(value || 0));

function findMatches(customer) {
  const credits = customer.ledgers.filter((row) => row.type === "CREDIT");
  const payments = customer.ledgers.filter((row) => row.type === "DEBIT");
  return payments.flatMap((payment) => {
    if (settlementTargetIds(payment.note).length) return [];
    const paymentDate = new Date(payment.date);
    const futureCredits = credits.filter((credit) => {
      const gap = (new Date(credit.date).getTime() - paymentDate.getTime()) / DAY_MS;
      return gap > 0 && gap <= 3 && rounded(credit.amount) === rounded(payment.amount);
    });
    const explicit = String(payment.note || "").includes("__PREPAYMENT__");
    if (!explicit && !futureCredits.length) return [];
    return [{
      payment: { id: payment.id, date: payment.date, amount: payment.amount, paymentType: payment.paymentType, note: payment.note },
      futureCredits: futureCredits.map((credit) => ({ id: credit.id, date: credit.date, amount: credit.amount, note: credit.note })),
      explicit,
      hasOlderCredits: credits.some((credit) => new Date(credit.date) < paymentDate),
    }];
  });
}

export async function GET() {
  try {
    await ensureDatabase();
    const customers = await prisma.customer.findMany({
      where: { deletedAt: null },
      select: {
        id: true, name: true, phone: true, routeTag: true, current_balance: true,
        ledgers: { select: { id: true, date: true, type: true, amount: true, note: true, paymentType: true }, orderBy: [{ date: "asc" }, { id: "asc" }] },
      },
      orderBy: { name: "asc" },
    });
    const data = customers.map((customer) => ({
      id: customer.id, name: customer.name, phone: customer.phone, routeTag: customer.routeTag,
      websiteBalance: rounded(customer.current_balance), matches: findMatches(customer),
    })).filter((customer) => customer.matches.length);
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 500 }); }
}
