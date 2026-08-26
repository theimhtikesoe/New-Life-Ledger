import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  try {
    await ensureDatabase();

    const customerId = params.id;
    const cashSaleId = params.saleId;

    const result = await prisma.$transaction(async (tx) => {
      const cashSale = await tx.cashSale.findFirst({
        where: { id: cashSaleId, customerId },
        include: { customer: { select: { id: true, name: true, current_balance: true } } },
      });

      if (!cashSale) {
        throw new Error("CashSale မတွေ့ပါ။");
      }

      const actorName = getActorName(request);
      const deletedAt = new Date();

      // The original creation activity must not remain visible after its business
      // record is deleted. Keep the audit history intact, but hide that old event.
      await tx.auditLog.updateMany({
        where: { entityType: "CashSale", entityId: cashSale.id, hiddenAt: null },
        data: { hiddenAt: deletedAt, hiddenBy: actorName },
      });

      await writeAuditLog({
        db: tx,
        actorName,
        action: "DELETE",
        entityType: "CashSale",
        entityId: cashSale.id,
        entityLabel: cashSale.customer.name,
        summary: `${cashSale.customer.name} ၏ လက်ငင်းရောင်း ${cashSale.amount.toLocaleString()} Ks မှတ်တမ်းကို ဖျက်`,
        metadata: {
          customerId: cashSale.customerId,
          amount: cashSale.amount,
          paymentType: cashSale.paymentType,
          note: cashSale.note,
          date: cashSale.date.toISOString(),
          deletedAt: deletedAt.toISOString(),
          balanceUnchanged: true,
          balanceAfter: cashSale.customer.current_balance,
        },
      });

      await tx.cashSale.delete({ where: { id: cashSale.id } });

      // CashSale is intentionally outside receivable arithmetic.
      return {
        customerId: cashSale.customerId,
        cashSaleId: cashSale.id,
        currentBalance: cashSale.customer.current_balance,
      };
    });

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    if (error.message === "CashSale မတွေ့ပါ။") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
