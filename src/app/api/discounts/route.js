import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const rows = await prisma.ledger.findMany({
      where: {
        type: "DEBIT",
        discountAmount: { gt: 0 },
        ...(q ? { customer: { name: { contains: q, mode: "insensitive" } } } : {}),
      },
      select: {
        id: true,
        customerId: true,
        date: true,
        amount: true,
        discountAmount: true,
        discountNote: true,
        note: true,
        paymentType: true,
        customer: { select: { id: true, name: true, phone: true, routeTag: true } },
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 500,
    });
    const total = rows.reduce((sum, row) => sum + row.discountAmount, 0);
    return NextResponse.json({ data: { rows, total, count: rows.length } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
