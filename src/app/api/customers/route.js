import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { normalizeCustomerName, normalizeCustomerPhone, normalizeCustomerRoute } from "@/lib/customer-identity";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await ensureDatabase();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const searchTerms = q ? Array.from(new Set([
      q,
      q.replace(/\s+/g, ""),
      q.replace(/\([^)]*\)/g, "").replace(/\s+/g, ""),
      Array.from(q.replace(/\s+/g, ""))[0],
    ].filter(Boolean))) : [];
    const showDeleted = searchParams.get("deleted") === "true";
    const includeLedgers = searchParams.get("includeLedgers") !== "false";
    const includeCashSales = searchParams.get("includeCashSales") === "true";

    // Optimized: Select only necessary fields to reduce data transfer
    // Better search for Burmese: prioritize startsWith, then fallback to contains
    // Keep the initial dashboard response small enough for slower Myanmar
    // mobile/VPN paths. Full transaction history is loaded on demand.
    const select = {
      id: true,
      name: true,
      phone: true,
      routeTag: true,
      customerType: true,
      current_balance: true,
      settledOutsideLedgerAt: true,
      settledOutsideLedgerBy: true,
      deletedAt: true,
      outsideSettlements: {
        select: { settledAt: true, actorName: true },
        orderBy: { settledAt: "desc" },
        take: 1,
      },
    };
    if (includeLedgers) {
      select.ledgers = {
        select: {
          id: true,
          date: true,
          type: true,
          saleType: true,
          cartons: true,
          rate: true,
          amount: true,
          discountAmount: true,
          discountNote: true,
          note: true,
          paymentType: true,
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      };
    }
    if (includeCashSales) {
      select.cashSales = {
        select: {
          id: true,
          date: true,
          saleType: true,
          amount: true,
          note: true,
          paymentType: true,
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      };
    }
    if (!includeLedgers) {
      select.ledgers = {
        where: { type: "DEBIT" },
        select: { date: true },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: 1,
      };
    }

    let customers = await prisma.customer.findMany({
      where: {
        AND: [
          q
            ? {
                OR: [
                  ...searchTerms.flatMap((term) => [
                    { name: { startsWith: term, mode: "insensitive" } },
                    { name: { contains: term, mode: "insensitive" } },
                  ]),
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
      select,
      orderBy: [{ name: "asc" }],
    });

    customers = customers.map((customer) => {
      const latestSettlement = customer.outsideSettlements?.[0];
      const latestDebit = customer.ledgers?.[0];
      const hasLaterPayment = latestSettlement && latestDebit && new Date(latestDebit.date) > new Date(latestSettlement.settledAt);
      const restored = latestSettlement && !hasLaterPayment && !customer.settledOutsideLedgerAt
        ? { settledOutsideLedgerAt: latestSettlement.settledAt, settledOutsideLedgerBy: latestSettlement.actorName }
        : {};
      const { outsideSettlements, ...rest } = customer;
      if (!includeLedgers) delete rest.ledgers;
      return { ...rest, ...restored };
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

    const normalizedName = normalizeCustomerName(name);
    const normalizedPhone = normalizeCustomerPhone(body.phone);
    const normalizedRoute = normalizeCustomerRoute(body.routeTag);
    const possibleDuplicates = await prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, phone: true, routeTag: true, current_balance: true },
      orderBy: { name: "asc" },
      take: 2000,
    });
    const duplicates = possibleDuplicates.filter((existing) => {
      const samePhone = normalizedPhone && normalizeCustomerPhone(existing.phone) === normalizedPhone;
      const sameName = normalizedName && normalizeCustomerName(existing.name) === normalizedName;
      const sameRoute = normalizedRoute && normalizeCustomerRoute(existing.routeTag) === normalizedRoute;
      return samePhone || sameName || (sameRoute && sameName);
    });
    if (duplicates.length > 0) {
      const names = duplicates.map((duplicate) => `${duplicate.name}${duplicate.phone ? ` (${duplicate.phone})` : ""}`).join(", ");
      return NextResponse.json({
        error: `အမည်/ဖုန်းတူသော Customer ရှိပြီးသားပါ — ${names}။ Customer အသစ်မထည့်ဘဲ ရှိပြီးသားစာရင်းကို ရွေးအသုံးပြုပါ။`,
        code: "DUPLICATE_CUSTOMER",
        duplicates,
      }, { status: 409 });
    }

    const currentBalance = Number(body.current_balance || 0);
    const customerType = String(body.customerType || "RETAIL").toUpperCase() === "WHOLESALE" ? "WHOLESALE" : "RETAIL";
    const customer = await prisma.$transaction(async (tx) => {
      const newCustomer = await tx.customer.create({
        data: {
          name,
          phone: body.phone?.trim() || null,
          routeTag: body.routeTag?.trim() || null,
          customerType,
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
