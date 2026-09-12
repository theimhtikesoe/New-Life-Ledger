import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getActorName, writeAuditLog } from "@/lib/audit";
import { PRICE_GROUPS, buildCatalog } from "@/lib/production-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The production database is configured with connection_limit=1. A canceled
// browser request can still be finishing on the server, so serialize the
// whole read handler instead of allowing a second priceSetting query to time
// out while waiting for the only connection.
let priceSettingsReadQueue = Promise.resolve();

async function acquirePriceSettingsRead() {
  const previous = priceSettingsReadQueue;
  let release;
  priceSettingsReadQueue = new Promise((resolve) => { release = resolve; });
  await previous;
  return release;
}

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
    tubeType: String(row.tubeType || "").trim(),
  };
}

export async function GET(request) {
  const release = await acquirePriceSettingsRead();
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
      else if (serialized.pricePerBottle > 0) exactItemPrices[row.productKey] = serialized;
    }

    const catalog = buildCatalog().map((item) => {
      const itemPriceRow = effectiveByKey.get(`ITEM:${item.productKey}`);
      const categoryPrice = effectiveByKey.get(`CATEGORY:${item.categoryKey}`);
      // A mapping-only ITEM row is intentionally stored with price 0. It must
      // not hide a valid category price used by settlement sales.
      const itemPrice = itemPriceRow && Number(itemPriceRow.pricePerBottle || 0) > 0 ? itemPriceRow : null;
      const effective = itemPrice || categoryPrice || null;
      return {
        ...item,
        tubeType: itemPriceRow?.tubeType || "",
        effectivePrice: effective
          ? { ...effective, source: itemPrice ? "ITEM" : "CATEGORY" }
          : (item.defaultPrice !== undefined ? { pricePerBottle: item.defaultPrice, pricePerCard: item.defaultPrice, source: "DEFAULT" } : null),
      };
    });

    const tubeMappings = {};
    for (const item of catalog) if (item.tubeType) tubeMappings[item.productKey] = item.tubeType;
    return NextResponse.json({ data: { date, categories: PRICE_GROUPS, catalog, categoryPrices: exactCategoryPrices, itemPrices: exactItemPrices, tubeMappings } });
  } catch (error) {
    console.error("Price settings read failed", error);
    if (/connection pool|Timed out fetching a new connection/i.test(String(error?.message || ""))) {
      return NextResponse.json({ error: "Database လက်ရှိအလုပ်များနေပါသည်။ စျေးနှုန်းစာရင်းကို ခဏစောင့်ပြီး ပြန်ဖွင့်ပါ။" }, { status: 503 });
    }
    return NextResponse.json({ error: error.message || "စျေးနှုန်းစာရင်း ရယူ၍မရပါ။" }, { status: 400 });
  } finally {
    release();
  }
}

export async function POST(request) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const priceDate = parseDate(body.priceDate);
    const categoryPrices = body.categoryPrices && typeof body.categoryPrices === "object" ? body.categoryPrices : {};
    const itemPrices = body.itemPrices && typeof body.itemPrices === "object" ? body.itemPrices : {};
    const tubeMappings = body.tubeMappings && typeof body.tubeMappings === "object" ? body.tubeMappings : {};
    const catalog = buildCatalog();
    const rows = [];

    for (const category of PRICE_GROUPS) {
      const raw = categoryPrices[category.key];
      if (raw === "" || raw === null || raw === undefined) continue;
      const pricePerBottle = positiveInt(raw, `${category.label} စျေးနှုန်း`);
      rows.push({ priceDate, scope: "CATEGORY", categoryKey: category.key, productKey: category.key, productType: category.productType || "bottle", productName: category.label, capacity: 0, bottlesPerCard: 0, pricePerBottle, pricePerCard: pricePerBottle });
    }

    for (const item of catalog) {
      const raw = itemPrices[item.productKey];
      if (raw === "" || raw === null || raw === undefined) continue;
      const pricePerBottle = positiveInt(raw, `${item.productName} ${item.capacity} စျေးနှုန်း`);
      rows.push({ priceDate, scope: "ITEM", categoryKey: item.categoryKey, productKey: item.productKey, productType: item.productType, productName: item.productName, capacity: item.capacity, bottlesPerCard: item.bottlesPerCard, pricePerBottle, pricePerCard: pricePerBottle * item.bottlesPerCard, tubeType: String(tubeMappings[item.productKey] || "").trim() || null });
    }

    for (const item of catalog) {
      if (item.productType === "cap" || itemPrices[item.productKey] !== undefined) continue;
      const tubeType = String(tubeMappings[item.productKey] || "").trim();
      if (!tubeType) continue;
      rows.push({ priceDate, scope: "ITEM", categoryKey: item.categoryKey, productKey: item.productKey, productType: item.productType, productName: item.productName, capacity: item.capacity, bottlesPerCard: item.bottlesPerCard, pricePerBottle: 0, pricePerCard: 0, tubeType });
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
        tubeMappingCount: Object.values(tubeMappings).filter(Boolean).length,
      },
    });
    const result = { count: rows.length };

    return NextResponse.json({ data: { priceDate, count: result.count } });
  } catch (error) {
    console.error("Price settings write failed", error);
    return NextResponse.json({ error: error.message || "စျေးနှုန်းသိမ်း၍မရပါ။" }, { status: 400 });
  }
}
