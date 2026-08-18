import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

function balanceDelta(type, amount) {
  // When deleting, we reverse the effect
  // CREDIT (အကြွေးတိုး) increased balance, so deleting it decreases balance
  // DEBIT (ငွေချေ) decreased balance, so deleting it increases balance
  return type === "CREDIT" ? -amount : amount;
}

export async function DELETE(request, { params }) {
  try {
    await ensureDatabase();

    const transactionId = params.id;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get the transaction to know its amount and type
      const ledger = await tx.ledger.findUnique({
        where: { id: transactionId },
        include: { customer: { select: { name: true } } },
      });

      if (!ledger) {
        throw new Error("Transaction not found");
      }

      // 2. Update customer balance
      const customer = await tx.customer.update({
        where: { id: ledger.customerId },
        data: {
          current_balance: {
            increment: balanceDelta(ledger.type, ledger.amount),
          },
        },
      });

      await writeAuditLog({
        db: tx,
        actorName: getActorName(request),
        action: "DELETE",
        entityType: "Ledger",
        entityId: ledger.id,
        entityLabel: ledger.customer.name,
        summary: `${ledger.customer.name} ၏ ${ledger.type === "CREDIT" ? "အကြွေးတိုး" : "ငွေချေ"} ${ledger.amount.toLocaleString()} Ks ကို ဖျက်`,
        metadata: {
          customerId: ledger.customerId,
          type: ledger.type,
          amount: ledger.amount,
          paymentType: ledger.paymentType,
          note: ledger.note,
          date: ledger.date.toISOString(),
          balanceAfter: customer.current_balance,
        },
      });

      // Keep the original delete behavior; the audit snapshot is written first.
      await tx.ledger.delete({
        where: { id: transactionId },
      });

      return { customerId: ledger.customerId, newBalance: customer.current_balance };
    });

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    if (error.message === "Transaction not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
