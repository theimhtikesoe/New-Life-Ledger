import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { settlementTargetIds } from "@/lib/ledger-settlement";

export const dynamic = "force-dynamic";

const SAMPLE_LIMIT = 20;

function rounded(value) {
  return Math.round(Number(value || 0));
}

export async function GET() {
  try {
    await ensureDatabase();

    const customers = await prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, current_balance: true },
    });
    const ledgerTotals = await prisma.ledger.groupBy({
      by: ["customerId", "type"],
      _sum: { amount: true, discountAmount: true },
      _count: { _all: true },
    });
    const totalsByCustomer = new Map();
    ledgerTotals.forEach((row) => {
      const current = totalsByCustomer.get(row.customerId) || { credit: 0, debit: 0, discount: 0, count: 0 };
      if (row.type === "CREDIT") current.credit += rounded(row._sum?.amount);
      if (row.type === "DEBIT") {
        current.debit += rounded(row._sum?.amount);
        current.discount += rounded(row._sum?.discountAmount);
      }
      current.count += Number(row._count?._all || 0);
      totalsByCustomer.set(row.customerId, current);
    });

    const balanceMismatches = customers.map((customer) => {
      const totals = totalsByCustomer.get(customer.id) || { credit: 0, debit: 0, discount: 0, count: 0 };
      const expected = totals.credit - totals.debit - totals.discount;
      const actual = rounded(customer.current_balance);
      return {
        customerId: customer.id,
        customerName: customer.name,
        actual,
        expected,
        difference: actual - expected,
        ledgerCount: totals.count,
      };
    }).filter((row) => row.difference !== 0)
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    const debits = await prisma.ledger.findMany({
      where: { type: "DEBIT" },
      select: { id: true, customerId: true, amount: true, date: true, note: true },
    });
    const targetIds = [...new Set(debits.flatMap((row) => settlementTargetIds(row.note)))];
    const targets = targetIds.length
      ? await prisma.ledger.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, customerId: true, type: true, amount: true, date: true },
      })
      : [];
    const targetById = new Map(targets.map((row) => [row.id, row]));
    const customerById = new Map(customers.map((row) => [row.id, row.name]));
    const referencesByTarget = new Map();
    const settlementExceptions = [];

    debits.forEach((debit) => {
      const ids = settlementTargetIds(debit.note);
      ids.forEach((targetId) => {
        referencesByTarget.set(targetId, [...(referencesByTarget.get(targetId) || []), debit]);
        const target = targetById.get(targetId);
        if (!target) {
          settlementExceptions.push({ type: "ORPHAN_LINK", paymentId: debit.id, targetId, amount: rounded(debit.amount), paymentDate: debit.date, customerId: debit.customerId, customerName: customerById.get(debit.customerId) || "" });
        } else if (target.customerId !== debit.customerId) {
          settlementExceptions.push({ type: "WRONG_CUSTOMER", paymentId: debit.id, targetId, amount: rounded(debit.amount), paymentDate: debit.date, customerId: debit.customerId, customerName: customerById.get(debit.customerId) || "" });
        } else if (target.type !== "CREDIT") {
          settlementExceptions.push({ type: "NOT_CREDIT", paymentId: debit.id, targetId, amount: rounded(debit.amount), paymentDate: debit.date, customerId: debit.customerId, customerName: customerById.get(debit.customerId) || "" });
        }
      });
    });

    referencesByTarget.forEach((payments, targetId) => {
      if (payments.length > 1) {
        const target = targetById.get(targetId);
        const linkedAmount = payments.reduce((sum, payment) => sum + rounded(payment.amount), 0);
        settlementExceptions.push({
          type: "MULTIPLE_PAYMENTS",
          targetId,
          paymentId: payments[0].id,
          amount: linkedAmount,
          targetAmount: rounded(target?.amount),
          targetDate: target?.date || null,
          customerId: target?.customerId || null,
          customerName: customerById.get(target?.customerId) || "",
        });
      }
    });

    return NextResponse.json({
      data: {
        generatedAt: new Date().toISOString(),
        balanceMismatchCount: balanceMismatches.length,
        balanceMismatchAmount: balanceMismatches.reduce((sum, row) => sum + Math.abs(row.difference), 0),
        balanceMismatches: balanceMismatches.slice(0, SAMPLE_LIMIT),
        settlementExceptionCount: settlementExceptions.length,
        settlementExceptions: settlementExceptions.slice(0, SAMPLE_LIMIT),
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
