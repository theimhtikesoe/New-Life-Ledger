import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getLatestTransactionDate, getMyanmarDateAgeInDays } from "@/lib/debt-utils";

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

    const overdueDebts = customers
      .map((customer) => {
        const latestTransactionDate = getLatestTransactionDate(customer.ledgers);
        if (!latestTransactionDate) return null;

        const daysOverdue = getMyanmarDateAgeInDays(latestTransactionDate);
        if (daysOverdue === null || daysOverdue < 15) return null;

        return {
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          balance: customer.current_balance,
          lastCreditDate: latestTransactionDate.toISOString(),
          daysOverdue,
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
