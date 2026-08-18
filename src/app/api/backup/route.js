import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDatabase();
    const [customers, transactions, auditLogs] = await Promise.all([
      prisma.customer.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          phone: true,
          routeTag: true,
          current_balance: true,
          createdAt: true,
          deletedAt: true,
        },
      }),
      prisma.ledger.findMany({
        orderBy: [{ date: "asc" }, { id: "asc" }],
        select: {
          id: true,
          customerId: true,
          date: true,
          type: true,
          saleType: true,
          itemSize: true,
          cartons: true,
          rate: true,
          deductions: true,
          amount: true,
          note: true,
          paymentType: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          actorName: true,
          action: true,
          entityType: true,
          entityId: true,
          entityLabel: true,
          summary: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        format: "new-life-ledger-backup",
        version: 1,
        generatedAt: new Date().toISOString(),
        counts: { customers: customers.length, transactions: transactions.length, auditLogs: auditLogs.length },
        customers,
        transactions,
        auditLogs,
      },
    });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
