import { NextResponse } from "next/server";
import { databaseErrorResponse, ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { customerDefaultCashSaleType, normalizeCashSaleType } from "@/lib/cash-sale-utils";
import { hasPaymentBreakdownInput, paymentSplitForInput } from "@/lib/payment-split";
import { invalidateFactoryStockCache, saleMovementRows } from "@/lib/factory-stock";

export const dynamic = "force-dynamic";

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
  paymentBreakdown: true,
  saleItems: true,
  createdAt: true,
};

function parseAmount(value) {
  const amount = Math.round(Number(value || 0));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("လက်ငင်းရောင်းပမာဏသည် ၀ ထက်ကြီးရပါမည်။");
  return amount;
}

function parseOptionalInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  if (!value) return new Date();
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("ရက်စွဲပုံစံ မမှန်ပါ။");
  const date = new Date(`${text}T00:00:00+06:30`);
  if (Number.isNaN(date.getTime())) throw new Error("ရက်စွဲပုံစံ မမှန်ပါ။");
  return date;
}

export async function PATCH(request, { params }) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const amount = parseAmount(body.amount);
    const paymentBreakdown = paymentSplitForInput(body, amount);
    const saleItems = Array.isArray(body.saleItems) && body.saleItems.length ? body.saleItems : null;
    const hasBreakdown = hasPaymentBreakdownInput(body.paymentBreakdown);
    const storedPaymentType = hasBreakdown ? "MIXED" : String(body.paymentType || "CASH").trim() || "CASH";
    const submittedDate = String(body.date || getMyanmarDateInputValue()).trim();
    const date = parseDate(body.date);
    const submittedSaleType = String(body.saleType || "").trim().toUpperCase();
    if (submittedDate >= "2026-09-12" && !["RETAIL", "WHOLESALE"].includes(submittedSaleType)) {
      return NextResponse.json({ error: "၂၀၂၆-၀၉-၁၂ ရက်နေ့မှစ၍ လက်လီ သို့မဟုတ် လက်ကားကို မဖြစ်မနေရွေးပါ။" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.cashSale.findFirst({ where: { id: params.saleId, customerId: params.id }, include: { customer: { select: { id: true, name: true, deletedAt: true } } } });
      if (!existing || existing.customer.deletedAt) throw new Error("CashSale မတွေ့ပါ။");
      const saleType = normalizeCashSaleType(submittedSaleType || existing.saleType || customerDefaultCashSaleType(existing.customer));
      const cashSale = await tx.cashSale.update({
        where: { id: existing.id },
        data: {
          saleType,
          itemSize: body.itemSize?.trim() || null,
          cartons: parseOptionalInteger(body.cartons),
          rate: parseOptionalInteger(body.rate),
          deductions: parseOptionalInteger(body.deductions) || 0,
          amount,
          note: body.note?.trim() || null,
          paymentType: storedPaymentType,
          paymentBreakdown,
          saleItems,
          date,
        },
        select: cashSaleSelect,
      });
      await tx.factoryStockMovement.deleteMany({ where: { sourceType: "CASH_SALE", sourceId: existing.id } });
      const movements = saleMovementRows([cashSale], { actorName: getActorName(request), sourceType: "CASH_SALE" });
      if (movements.length) await tx.factoryStockMovement.createMany({ data: movements });
      await writeAuditLog({ db: tx, actorName: getActorName(request), action: "UPDATE", entityType: "CashSale", entityId: cashSale.id, entityLabel: existing.customer.name, summary: `${existing.customer.name} ၏ လက်ငင်းရောင်းစာရင်း ပြင်ဆင်`, metadata: { before: { amount: existing.amount, date: existing.date, saleType: existing.saleType }, after: { amount: cashSale.amount, date: cashSale.date, saleType: cashSale.saleType } } });
      return cashSale;
    });
    invalidateFactoryStockCache();
    return NextResponse.json({ data: { cashSale: result } });
  } catch (error) {
    if (error.message === "CashSale မတွေ့ပါ။") return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(databaseErrorResponse(error), { status: error.message?.includes("ပမာဏ") || error.message?.includes("ရက်စွဲ") ? 400 : 500 });
  }
}

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

      // Remove the sale-derived stock movements together with the Cash Sale row.
      // Otherwise deleted bottle/cap sales would continue reducing Factory Stock.
      await tx.factoryStockMovement.deleteMany({ where: { sourceType: "CASH_SALE", sourceId: cashSale.id } });
      await tx.cashSale.delete({ where: { id: cashSale.id } });

      // CashSale is intentionally outside receivable arithmetic.
      return {
        customerId: cashSale.customerId,
        cashSaleId: cashSale.id,
        currentBalance: cashSale.customer.current_balance,
      };
    });

    invalidateFactoryStockCache();
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    if (error.message === "CashSale မတွေ့ပါ။") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(databaseErrorResponse(error), { status: 500 });
  }
}
