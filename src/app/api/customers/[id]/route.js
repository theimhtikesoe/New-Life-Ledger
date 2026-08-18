import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    await ensureDatabase();

        const id = params.id;
    const { searchParams } = new URL(request.url);
    const includeLedgers = searchParams.get("includeLedgers") !== "false";
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        routeTag: true,
        current_balance: true,
        createdAt: true,
        deletedAt: true,
        kpayAliases: {
          select: {
            id: true,
            kpayName: true,
          },
          orderBy: { kpayName: "asc" },
        },
        // Keep the legacy response shape by default; the dashboard can opt out
        // and load history through the paginated transactions endpoint.
        ...(includeLedgers
          ? {
              ledgers: {
                select: {
                  id: true,
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
                },
                orderBy: [{ date: "desc" }, { id: "desc" }],
                take: 50,
              },
            }
          : {}),
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ data: customer });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    await ensureDatabase();

    const id = params.id;
    const body = await request.json();

    const data = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.routeTag !== undefined) data.routeTag = body.routeTag?.trim() || null;
    if (body.restore === true) data.deletedAt = null;

    const customer = await prisma.customer.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        phone: true,
        routeTag: true,
        current_balance: true,
        createdAt: true,
        deletedAt: true,
        kpayAliases: {
          select: {
            id: true,
            kpayName: true,
          },
          orderBy: { kpayName: "asc" },
        },
        ledgers: {
          select: {
            id: true,
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
          },
          orderBy: { date: "desc" },
          take: 50,
        },
      },
    });

    return NextResponse.json({ data: customer });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await ensureDatabase();

    const id = params.id;
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get("permanent") === "true";

    if (!id) {
      return NextResponse.json({ error: "Customer id is required" }, { status: 400 });
    }

    let customer;
    if (permanent) {
      customer = await prisma.customer.delete({
        where: { id },
        select: { id: true, name: true },
      });
    } else {
      customer = await prisma.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: { id: true, name: true, deletedAt: true },
      });
    }

    return NextResponse.json({ data: customer });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
