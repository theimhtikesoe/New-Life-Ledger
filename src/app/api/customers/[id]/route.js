import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ledgerSelect = {
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
};

const cashSaleSelect = {
  id: true,
  date: true,
  saleType: true,
  itemSize: true,
  cartons: true,
  rate: true,
  deductions: true,
  amount: true,
  note: true,
  paymentType: true,
  createdAt: true,
};

export async function GET(request, { params }) {
  try {
    await ensureDatabase();

    const id = params.id;
    const { searchParams } = new URL(request.url);
    const includeLedgers = searchParams.get("includeLedgers") !== "false";
    const includeCashSales = searchParams.get("includeCashSales") !== "false";
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
          select: { id: true, kpayName: true },
          orderBy: { kpayName: "asc" },
        },
          ...(includeLedgers
          ? {
              ledgers: {
                select: ledgerSelect,
                orderBy: [{ date: "desc" }, { id: "desc" }],
                take: 50,
              },
            }
          : {}),
        ...(includeCashSales
          ? {
              cashSales: {
                select: cashSaleSelect,
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
          select: { id: true, kpayName: true },
          orderBy: { kpayName: "asc" },
        },
        ledgers: {
          select: ledgerSelect,
          orderBy: [{ date: "desc" }, { id: "desc" }],
          take: 50,
        },
        cashSales: {
          select: cashSaleSelect,
          orderBy: [{ date: "desc" }, { id: "desc" }],
          take: 50,
        },
      },
    });

    await writeAuditLog({
      actorName: getActorName(request),
      action: body.restore === true ? "RESTORE" : "UPDATE",
      entityType: "Customer",
      entityId: customer.id,
      entityLabel: customer.name,
      summary: body.restore === true ? `Customer ပြန်ယူ: ${customer.name}` : `Customer ပြင်ဆင်: ${customer.name}`,
      metadata: { changedFields: Object.keys(data), restore: body.restore === true },
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

    await writeAuditLog({
      actorName: getActorName(request),
      action: permanent ? "PERMANENT_DELETE" : "DELETE",
      entityType: "Customer",
      entityId: customer.id,
      entityLabel: customer.name,
      summary: permanent ? `Customer အပြီးဖျက်: ${customer.name}` : `Customer ဖျက်/Recycle Bin သို့ရွှေ့: ${customer.name}`,
      metadata: { permanent },
    });

    return NextResponse.json({ data: customer });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
