import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { BOTTLE_GROUPS, BOTTLE_ITEMS, getBottleGroup } from "@/lib/production-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("စျေးနှုန်းသတ်မှတ်မည့် Date မမှန်ပါ။");
  return date;
}

function positiveInt(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} သည် ၀ သို့မဟုတ် အပေါင်းကိန်း ဖြစ်ရပါမည်။`);
  return parsed;
}

function productKey(productName, capacity) {
  return `${productName}::${capacity}`;
}

function buildCatalog() {
  return BOTTLE_ITEMS.flatMap((item) => item.capacities.map((capacity) => ({
    scope: "ITEM",
    productType: "bottle",
    productKey: productKey(item.type, capacity),
    categoryKey: getBottleGroup(item.type),
    categoryLabel: BOTTLE_GROUPS.find((group) => group.key === getBottleGroup(item.type))?.label || getBottleGroup(item.type),
    productName: item.type,
    capacity,
    bottlesPerCard: capacity,
  })));
}

function serialize(row) {
  return {
    id: row.id,
    priceDate: row.priceDate,
    scope: row.scope,
    categoryKey: row.categoryKey,
    productKey: row.productKey,
    productType: row.productType,
    productName: row.productName,
    capacity: Number(row.capacity || 0),
    bottlesPerCard: Number(row.bottlesPerCard || 0),
    pricePerBottle: Number(row.pricePerBottle || 0),
    pricePerCard: Number(row.pricePerCard || 0),
  };
}

export async function GET(request) {
  try {
    await ensureDatabase();
    const date = parseDate(new URL(request.url).searchParams.get("date"));
    const exactRows = await prisma.priceSetting.findMany({ where: { priceDate: date }, orderBy: [{ scope: "asc" }, { productName: "asc" }, { capacity: "asc" }] });
    const priorRows = await prisma.priceSetting.findMany({ where: { priceDate: { lte: date } }, orderBy: [{ priceDate: "desc" }, { updatedAt: "desc" }] });

    const effectiveByKey = new Map();
    for (const row of priorRows) {
      const key = `${row.scope}:${row.productKey}`;
      if (!effectiveByKey.has(key)) effectiveByKey.set(key, serialize(row));
    }

    const exactCategoryPrices = {};
    const exactItemPrices = {};
    for (const row of exactRows) {
      const serialized = serialize(row);
      if (row.scope === "CATEGORY") exactCategoryPrices[row.productKey] = serialized;
      else exactItemPrices[row.productKey] = serialized;
    }

    const catalog = buildCatalog().map((item) => {
      const itemPrice = effectiveByKey.get(`ITEM:${item.productKey}`);
      const categoryPrice = effectiveByKey.get(`CATEGORY:${item.categoryKey}`);
      const effective = itemPrice || categoryPrice || null;
      return {
        ...item,
        effectivePrice: effective
          ? { ...effective, source: itemPrice ? "ITEM" : "CATEGORY" }
          : null,
      };
    });

    return NextResponse.json({ data: { date, categories: BOTTLE_GROUPS, catalog, categoryPrices: exactCategoryPrices, itemPrices: exactItemPrices } });
  } catch (error) {
    console.error("Price settings read failed", error);
    return NextResponse.json({ error: error.message || "စျေးနှုန်းစာရင်း ရယူ၍မရပါ။" }, { status: 400 });
  }
}

export async function POST(request) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const priceDate = parseDate(body.priceDate);
    const categoryPrices = body.categoryPrices && typeof body.categoryPrices === "object" ? body.categoryPrices : {};
    const itemPrices = body.itemPrices && typeof body.itemPrices === "object" ? body.itemPrices : {};
    const catalog = buildCatalog();
    const rows = [];

    for (const category of BOTTLE_GROUPS) {
      const raw = categoryPrices[category.key];
      if (raw === "" || raw === null || raw === undefined) continue;
      const pricePerBottle = positiveInt(raw, `${category.label} စျေးနှုန်း`);
      rows.push({ priceDate, scope: "CATEGORY", categoryKey: category.key, productKey: category.key, productType: "bottle", productName: category.label, capacity: 0, bottlesPerCard: 0, pricePerBottle, pricePerCard: 0 });
    }

    for (const item of catalog) {
      const raw = itemPrices[item.productKey];
      if (raw === "" || raw === null || raw === undefined) continue;
      const pricePerBottle = positiveInt(raw, `${item.productName} ${item.capacity} စျေးနှုန်း`);
      rows.push({ priceDate, scope: "ITEM", categoryKey: item.categoryKey, productKey: item.productKey, productType: item.productType, productName: item.productName, capacity: item.capacity, bottlesPerCard: item.bottlesPerCard, pricePerBottle, pricePerCard: pricePerBottle * item.bottlesPerCard });
    }

    // Save the whole date in two bulk operations. The previous per-item
    // interactive transaction could exceed Prisma's short serverless
    // transaction timeout and fail with "Transaction not found".
    await prisma.$transaction([
      prisma.priceSetting.deleteMany({ where: { priceDate } }),
      ...(rows.length ? [prisma.priceSetting.createMany({ data: rows })] : []),
    ]);
    await writeAuditLog({
      db: prisma,
      actorName: getActorName(request),
      action: "PRICE_SETTINGS_UPDATE",
      entityType: "PriceSetting",
      entityId: priceDate,
      entityLabel: priceDate,
      summary: `${priceDate} အတွက် စျေးနှုန်းသတ်မှတ်ချက် ပြင်ဆင်`,
      metadata: {
        priceDate,
        categoryCount: Object.keys(categoryPrices).filter((key) => categoryPrices[key] !== "").length,
        itemCount: Object.keys(itemPrices).filter((key) => itemPrices[key] !== "").length,
      },
    });
    const result = { count: rows.length };

    return NextResponse.json({ data: { priceDate, count: result.count } });
  } catch (error) {
    console.error("Price settings write failed", error);
    return NextResponse.json({ error: error.message || "စျေးနှုန်းသိမ်း၍မရပါ။" }, { status: 400 });
  }
}
