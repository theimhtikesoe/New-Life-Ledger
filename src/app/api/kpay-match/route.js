import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    await ensureDatabase();

    const body = await request.json();
    const unverifiedKpayId = body.pendingKpayId || body.unverifiedKpayId;
    const customerId = body.customerId;

    if (!unverifiedKpayId || !customerId) {
      return NextResponse.json(
        { error: "unverifiedKpayId and customerId are required" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const kpay = await tx.unverifiedKpay.findUnique({
        where: { id: unverifiedKpayId },
      });

      if (!kpay || kpay.status !== "PENDING") {
        throw new Error("KPay item is not pending");
      }

      const amount = Math.round(Number(body.amount || kpay.amount || 0));
      const kpayName = body.kpayName?.trim() || kpay.kpayName || null;

      if (kpayName) {
        await tx.kpayAlias.upsert({
          where: { kpayName },
          update: { customerId },
          create: { kpayName, customerId },
        });
      }

      const customer = await tx.customer.update({
        where: { id: customerId },
        data: {
          current_balance: {
            decrement: amount,
          },
        },
      });

      const ledger = await tx.ledger.create({
        data: {
          customerId,
          type: "DEBIT",
          saleType: body.saleType || "RETAIL",
          amount,
          deductions: 0,
          paymentType: "KPay",
          note: `Matched KPay${kpayName ? `: ${kpayName}` : ""}`,
          date: kpay.createdAt,
        },
      });

      await writeAuditLog({
        db: tx,
        actorName: getActorName(request),
        action: "PAYMENT",
        entityType: "KPayMatch",
        entityId: ledger.id,
        entityLabel: kpayName || customer.name,
        summary: `${customer.name} နှင့် KPay ${amount.toLocaleString()} Ks တွဲချိတ်`,
        metadata: { customerId, unverifiedKpayId, amount, kpayName },
      });

      const matched = await tx.unverifiedKpay.delete({
        where: { id: unverifiedKpayId },
      });

      return { customer, ledger, kpay: matched };
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
