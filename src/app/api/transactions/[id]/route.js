import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { getMyanmarDayRange } from "@/lib/myanmar-time";
import { saleMovementRows } from "@/lib/factory-stock";

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

      // Remove the sale-derived stock movements together with the Ledger row.
      // Otherwise deleted bottle/cap sales would continue reducing Factory Stock.
      await tx.factoryStockMovement.deleteMany({ where: { sourceType: "LEDGER", sourceId: ledger.id } });
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
    const result = await prisma.$transaction(async (tx) => {
      const ledger = await tx.ledger.findUnique({
        where: { id: transactionId },
        include: { customer: { select: { name: true } } },
      });
      if (!ledger) throw new Error("Transaction not found");
      const type = body.type === "DEBIT" || body.type === "CREDIT" ? body.type : ledger.type;
      const amount = Math.round(Number(body.amount));
      const discountAmount = type === "DEBIT" ? Math.max(0, Math.round(Number(body.discountAmount || 0))) : 0;
      const discountNote = type === "DEBIT" ? body.discountNote?.trim() || null : null;
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount must be greater than zero");
      const saleItems = Array.isArray(body.saleItems) && body.saleItems.length ? body.saleItems : null;
      const date = body.date ? getMyanmarDayRange(body.date).start : ledger.date;
      const previousEffect = ledger.type === "CREDIT" ? ledger.amount : -(ledger.amount + (ledger.discountAmount || 0));
      const nextEffect = type === "CREDIT" ? amount : -(amount + discountAmount);
      const balanceAdjustment = nextEffect - previousEffect;
      const customer = await tx.customer.update({
        where: { id: ledger.customerId },
        data: { current_balance: { increment: balanceAdjustment } },
        select: { current_balance: true, name: true },
      });
      const updated = await tx.ledger.update({
        where: { id: transactionId },
        data: {
          type,
          saleType: body.saleType || ledger.saleType || "RETAIL",
          itemSize: body.itemSize?.trim() || null,
          cartons: body.cartons ? Math.round(Number(body.cartons)) : null,
          rate: body.rate ? Math.round(Number(body.rate)) : null,
          deductions: Math.round(Number(body.deductions || 0)),
          amount,
          discountAmount,
          discountNote,
          note: body.note?.trim() || null,
          paymentType: body.paymentType || null,
          saleItems,
          date,
        },
        select: {
          id: true, customerId: true, date: true, type: true, saleType: true, itemSize: true,
          cartons: true, rate: true, deductions: true, amount: true, discountAmount: true,
          discountNote: true, note: true, paymentType: true, saleItems: true,
        },
      });
      await tx.factoryStockMovement.deleteMany({ where: { sourceType: "LEDGER", sourceId: ledger.id } });
      const stockMovements = saleMovementRows([updated], { actorName: getActorName(request), sourceType: "LEDGER" });
      if (stockMovements.length) await tx.factoryStockMovement.createMany({ data: stockMovements });
      await writeAuditLog({
        db: tx,
        actorName: getActorName(request),
        action: "UPDATE",
        entityType: "Ledger",
        entityId: ledger.id,
        entityLabel: customer.name,
        summary: `${customer.name} ၏ ${type === "CREDIT" ? "အကြွေးတိုး" : "ငွေချေ"} မှတ်တမ်းကို ပြင်ဆင်`,
        metadata: {
          customerId: ledger.customerId,
          transactionId,
          previous: { type: ledger.type, amount: ledger.amount, discountAmount: ledger.discountAmount, date: ledger.date.toISOString(), saleItems: ledger.saleItems },
          updated: { type, amount, discountAmount, discountNote, date: updated.date.toISOString(), saleItems: updated.saleItems },
          balanceAdjustment,
        },
      });
      return { ledger: updated, current_balance: customer.current_balance };
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error.message === "Transaction not found" || error.message === "amount must be greater than zero") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
