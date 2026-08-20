import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await ensureDatabase();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const showDeleted = searchParams.get("deleted") === "true";

    // Optimized: Select only necessary fields to reduce data transfer
    // Better search for Burmese: prioritize startsWith, then fallback to contains
    const customers = await prisma.customer.findMany({
      where: {
        AND: [
          q
            ? {
                OR: [
                  { name: { startsWith: q, mode: "insensitive" } },
                  { name: { contains: q, mode: "insensitive" } },
                  { phone: { contains: q, mode: "insensitive" } },
                  { routeTag: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
          {
            deletedAt: showDeleted ? { not: null } : null,
          },
        ],
      },
      // Keep the initial dashboard response small enough for slower Myanmar
      // mobile/VPN paths. Full transaction history is loaded on demand.
      select: {
        id: true,
        name: true,
        phone: true,
        routeTag: true,
        current_balance: true,
        deletedAt: true,
        ledgers: {
          select: {
            id: true,
            date: true,
            type: true,
            saleType: true,
            cartons: true,
            rate: true,
            amount: true,
            note: true,
            paymentType: true,
          },
          orderBy: [{ date: "desc" }, { id: "desc" }],
        },
      },
      orderBy: [
        {
          name: "asc",
        },
      ],
    });

    // Post-process to sort startsWith matches first for better UX
    if (q) {
      customers.sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q.toLowerCase());
        const bStarts = b.name.toLowerCase().startsWith(q.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    return NextResponse.json({ data: customers });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureDatabase();

    const body = await request.json();
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const currentBalance = Number(body.current_balance || 0);
    const customer = await prisma.$transaction(async (tx) => {
      const newCustomer = await tx.customer.create({
        data: {
          name,
          phone: body.phone?.trim() || null,
          routeTag: body.routeTag?.trim() || null,
          current_balance: currentBalance,
        },
      });

      if (currentBalance !== 0) {
        await tx.ledger.create({
          data: {
            customerId: newCustomer.id,
            type: currentBalance > 0 ? "CREDIT" : "DEBIT",
            saleType: "RETAIL",
            amount: Math.abs(currentBalance),
            note: "အစ လက်ကျန် အကြွေး (Opening Balance)",
            date: new Date(),
          },
        });
      }

      return newCustomer;
    });

    await writeAuditLog({
      actorName: getActorName(request),
      action: "CREATE",
      entityType: "Customer",
      entityId: customer.id,
      entityLabel: customer.name,
      summary: `Customer အသစ်ထည့်: ${customer.name}`,
      metadata: { phone: customer.phone, routeTag: customer.routeTag, openingBalance: currentBalance },
    });

    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
