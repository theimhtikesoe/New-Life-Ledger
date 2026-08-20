import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getOldestUnpaidCreditDate } from "@/lib/debt-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDatabase();

    const customers = await prisma.customer.findMany({
      where: {
        deletedAt: null,
        current_balance: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        current_balance: true,
        ledgers: {
          select: { date: true, type: true, amount: true },
          orderBy: [{ date: "asc" }],
        },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fifteenDaysAgo = new Date(today);
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const overdueDebts = customers
      .map((customer) => {
        const oldestUnpaidDate = getOldestUnpaidCreditDate(customer.ledgers);
        if (!oldestUnpaidDate) return null;

        const creditDate = new Date(oldestUnpaidDate);
        creditDate.setHours(0, 0, 0, 0);
        if (creditDate > fifteenDaysAgo) return null;

        return {
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          balance: customer.current_balance,
          lastCreditDate: creditDate.toISOString(),
          daysOverdue: Math.floor((today - creditDate) / (1000 * 60 * 60 * 24)),
          totalDebt: customer.current_balance,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    return NextResponse.json({ data: overdueDebts });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
