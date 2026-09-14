import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { normalizeCashSaleType } from "@/lib/cash-sale-utils";
import { getWholesaleTracking } from "@/lib/wholesale-tracking";
import { invalidateFactoryStockCache, saleMovementRows } from "@/lib/factory-stock";
import { getMyanmarDateInputValue, getMyanmarDayRange } from "@/lib/myanmar-time";

export const dynamic = "force-dynamic";
const SALE_TYPE_REQUIRED_FROM = "2026-09-12";

export async function GET(request, { params }) {
  try {
    await ensureDatabase();
    const customerId = params.id;
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") || 50);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 50, 1), 100);
    const requestedOffset = Number(searchParams.get("offset") || 0);
    const offset = Math.max(Number.isFinite(requestedOffset) ? Math.floor(requestedOffset) : 0, 0);
    const type = searchParams.get("type");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const date = {};
    if (startDate) date.gte = getMyanmarDayRange(startDate).start;
    if (endDate) date.lt = getMyanmarDayRange(endDate).end;
    const where = {
      customerId,
      ...(type === "CREDIT" || type === "DEBIT" ? { type } : {}),
      ...(Object.keys(date).length ? { date } : {}),
    };
    const select = {
      id: true, date: true, createdAt: true, actorName: true, type: true, saleType: true, itemSize: true,
      cartons: true, rate: true, deductions: true, amount: true,
      discountAmount: true, discountNote: true, note: true,
      paymentType: true, saleItems: true,
    };
    // Production uses connection_limit=1; do not request the list and count
    // connections concurrently when another device is saving a transaction.
    const items = await prisma.ledger.findMany({ where, select, orderBy: [{ date: "desc" }, { id: "desc" }], skip: offset, take: limit });
    const total = await prisma.ledger.count({ where });
    return NextResponse.json({ data: { items, pagination: { offset, limit, total, hasMore: offset + items.length < total } } });
  } catch (error) {
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    await ensureDatabase();
    const customerId = params.id;
    const body = await request.json();
    const type = body.type === "DEBIT" ? "DEBIT" : "CREDIT";
    const amount = Math.round(Number(body.amount || 0));
    const discountAmount = type === "DEBIT" ? Math.max(0, Math.round(Number(body.discountAmount || 0))) : 0;
    const discountNote = type === "DEBIT" ? body.discountNote?.trim() || null : null;
    const deductions = Math.round(Number(body.deductions || 0));
    const saleItems = type === "CREDIT" && Array.isArray(body.saleItems) && body.saleItems.length ? body.saleItems : null;
    const todayMyanmar = getMyanmarDateInputValue();
    const ledgerDate = body.date || todayMyanmar;
    if (ledgerDate > todayMyanmar) {
      return NextResponse.json({ error: "အနာဂတ်ရက်စွဲဖြင့် စာရင်းသိမ်း၍မရပါ။ ဒီနေ့ သို့မဟုတ် အတိတ်ရက်ကိုသာ ရွေးပါ။" }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "amount must be greater than zero" }, { status: 400 });
    }
    const submittedSaleType = String(body.saleType || "").trim().toUpperCase();
    if (ledgerDate >= SALE_TYPE_REQUIRED_FROM && !["RETAIL", "WHOLESALE"].includes(submittedSaleType)) {
      return NextResponse.json({ error: "၂၀၂၆-၀၉-၁၂ ရက်နေ့မှစ၍ လက်လီ သို့မဟုတ် လက်ကားကို မဖြစ်မနေရွေးပါ။ မရွေးရသေးသော data ကို မသိမ်းပါ။" }, { status: 400 });
    }
    const settlementMatch = type === "DEBIT"
      ? String(body.note || "").match(/^__SETTLES_CREDIT_LEDGER__:(\S+)$/)
      : null;
    const result = await prisma.$transaction(async (tx) => {
      if (settlementMatch) {
        const target = await tx.ledger.findUnique({ where: { id: settlementMatch[1] }, select: { customerId: true, date: true, type: true, amount: true } });
        if (!target || target.customerId !== customerId || target.type !== "CREDIT") throw new Error("ရွေးထားသော အကြွေးမှတ်တမ်း မတွေ့ပါ။");
        if (getMyanmarDateInputValue(target.date) > ledgerDate) throw new Error("အနာဂတ်အကြွေးကို မချေနိုင်ပါ။ အကြွေးတိုးသည့်နေ့ သို့မဟုတ် ထိုနောက်ပိုင်းရက်ကိုသာ ရွေးပါ။");
      }
      const customer = await tx.customer.update({
        where: { id: customerId },
        data: {
          current_balance: { increment: type === "CREDIT" ? amount : -(amount + discountAmount) },
          settledOutsideLedgerAt: null,
          settledOutsideLedgerBy: null,
        },
        select: { id: true, name: true, phone: true, routeTag: true, current_balance: true, createdAt: true },
      });
      const ledger = await tx.ledger.create({
        data: {
          customerId, actorName: getActorName(request), type, saleType: submittedSaleType ? normalizeCashSaleType(submittedSaleType) : "RETAIL",
          itemSize: body.itemSize?.trim() || null,
          cartons: body.cartons ? Math.round(Number(body.cartons)) : null,
          rate: body.rate ? Math.round(Number(body.rate)) : null,
          deductions, amount, discountAmount, discountNote,
          note: body.note?.trim() || null,
          paymentType: body.paymentType || null, saleItems,
          date: getMyanmarDayRange(ledgerDate).start,
        },
        select: {
          id: true, date: true, createdAt: true, actorName: true, type: true, saleType: true, itemSize: true,
          cartons: true, rate: true, deductions: true, amount: true,
          discountAmount: true, discountNote: true, note: true,
          paymentType: true, saleItems: true,
        },
      });
      const stockMovements = saleMovementRows([ledger], { actorName: getActorName(request), sourceType: "LEDGER" });
      if (stockMovements.length) await tx.factoryStockMovement.createMany({ data: stockMovements });
      await writeAuditLog({
        db: tx, actorName: getActorName(request), action: type === "DEBIT" ? "PAYMENT" : "DEBT_INCREASE",
        entityType: "Ledger", entityId: ledger.id, entityLabel: customer.name,
        summary: type === "DEBIT"
          ? `${customer.name} ထံမှ ငွေချေ ${amount.toLocaleString()} Ks${discountAmount ? ` (လျှော့ ${discountAmount.toLocaleString()} Ks)` : ""}`
          : `${customer.name} အကြွေးတိုး ${amount.toLocaleString()} Ks`,
        metadata: { customerId, type, amount, discountAmount, discountNote, paymentType: ledger.paymentType, note: ledger.note, saleItems: ledger.saleItems, wholesaleTracking: getWholesaleTracking(amount) },
      });
      return { customer, ledger };
    });
    invalidateFactoryStockCache();
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error.message.includes("အကြွေးမှတ်တမ်း") || error.message.includes("အနာဂတ်အကြွေး")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
