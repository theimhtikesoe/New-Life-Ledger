import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

function balanceDelta(type, amount, discountAmount = 0) {
  // When deleting, we reverse the effect
  // CREDIT (အကြွေးတိုး) increased balance, so deleting it decreases balance
  // DEBIT (ငွေချေ) decreased balance, so deleting it increases balance
  return type === "CREDIT" ? -amount : amount + discountAmount;
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
            increment: balanceDelta(ledger.type, ledger.amount, ledger.discountAmount),
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
          discountAmount: ledger.discountAmount,
          discountNote: ledger.discountNote,
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

export async function PATCH(request, { params }) {
  try {
    await ensureDatabase();
    const transactionId = params.id;
    const body = await request.json();
    const discountAmount = Math.max(0, Math.round(Number(body.discountAmount || 0)));
    const discountNote = body.discountNote?.trim() || null;

    const result = await prisma.$transaction(async (tx) => {
      const ledger = await tx.ledger.findUnique({
        where: { id: transactionId },
        include: { customer: { select: { name: true } } },
      });
      if (!ledger) throw new Error("Transaction not found");
      if (ledger.type !== "DEBIT") throw new Error("Only payment transactions can receive discounts");

      const previousDiscount = ledger.discountAmount || 0;
      const balanceAdjustment = -(discountAmount - previousDiscount);
      const customer = await tx.customer.update({
        where: { id: ledger.customerId },
        data: { current_balance: { increment: balanceAdjustment } },
        select: { current_balance: true },
      });
      const updated = await tx.ledger.update({
        where: { id: transactionId },
        data: { discountAmount, discountNote },
        select: {
          id: true, customerId: true, date: true, type: true, amount: true,
          discountAmount: true, discountNote: true, note: true, paymentType: true,
        },
      });
      await writeAuditLog({
        db: tx,
        actorName: getActorName(request),
        action: "PAYMENT_DISCOUNT",
        entityType: "Ledger",
        entityId: ledger.id,
        entityLabel: ledger.customer.name,
        summary: `${ledger.customer.name} ငွေချေ ${ledger.amount.toLocaleString()} Ks တွင် လျှော့စျေး ${discountAmount.toLocaleString()} Ks သတ်မှတ်`,
        metadata: { customerId: ledger.customerId, transactionId, previousDiscount, discountAmount, discountNote, balanceAdjustment },
      });
      return { ledger: updated, current_balance: customer.current_balance };
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error.message === "Transaction not found" || error.message === "Only payment transactions can receive discounts") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
