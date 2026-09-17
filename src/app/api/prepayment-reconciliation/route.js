import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDatabase, databaseErrorResponse } from "@/lib/database";
import { settlementTargetIds } from "@/lib/ledger-settlement";

export const dynamic = "force-dynamic";
const rounded = (value) => Math.round(Number(value || 0));

function currentPrepayments(ledgers) {
  const queue = [];
  let outstandingDebt = 0;
  const rows = [...ledgers].sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.id).localeCompare(String(b.id)));
  for (const row of rows) {
    const amount = rounded(row.amount);
    if (row.type === "CREDIT") {
      let credit = amount;
      while (credit > 0 && queue.length) {
        const item = queue[0];
        const applied = Math.min(item.remainingAmount, credit);
        item.remainingAmount -= applied;
        credit -= applied;
        if (item.remainingAmount <= 0) queue.shift();
      }
      outstandingDebt += credit;
    } else if (row.type === "DEBIT" && !settlementTargetIds(row.note).length) {
      if (outstandingDebt >= amount) {
        outstandingDebt -= amount;
      } else {
        const surplus = amount - outstandingDebt;
        outstandingDebt = 0;
        queue.push({ payment: row, remainingAmount: surplus });
      }
    }
  }
  return queue.filter((item) => item.remainingAmount > 0).map((item) => ({
    payment: { id: item.payment.id, date: item.payment.date, amount: item.payment.amount, paymentType: item.payment.paymentType, note: item.payment.note },
    remainingAmount: item.remainingAmount,
  }));
}

export async function GET() {
  try {
    await ensureDatabase();
    const customers = await prisma.customer.findMany({ where: { deletedAt: null }, select: { id: true, name: true, phone: true, routeTag: true, current_balance: true }, orderBy: { name: "asc" } });
    const ledgers = await prisma.ledger.findMany({
      where: { type: { in: ["CREDIT", "DEBIT"] }, customerId: { in: customers.map((customer) => customer.id) } },
      select: { id: true, customerId: true, date: true, type: true, amount: true, note: true, paymentType: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });
    const byCustomer = new Map(customers.map((customer) => [customer.id, []]));
    for (const ledger of ledgers) byCustomer.get(ledger.customerId)?.push(ledger);
    const data = customers.map((customer) => {
      const prepayments = currentPrepayments(byCustomer.get(customer.id) || []);
      const balance = Math.max(0, -rounded(customer.current_balance));
      return {
        id: customer.id, name: customer.name, phone: customer.phone, routeTag: customer.routeTag,
        prepaymentBalance: balance,
        matches: prepayments.map((item) => ({ payment: item.payment, remainingAmount: item.remainingAmount, futureCredits: [] })),
      };
    }).filter((customer) => customer.prepaymentBalance > 0 && customer.matches.length);
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json(databaseErrorResponse(error), { status: 500 }); }
}
