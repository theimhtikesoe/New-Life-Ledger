import { prisma } from "@/lib/prisma";
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";

export const STOCK_TYPES = {
  BOTTLE: "BOTTLE",
  CAP: "CAP",
  TUBE: "TUBE",
};

export const MOVEMENT_TYPES = {
  OPENING_BALANCE: "OPENING_BALANCE",
  PRODUCTION_IN: "PRODUCTION_IN",
  SALE_OUT: "SALE_OUT",
  PRODUCTION_USE_OUT: "PRODUCTION_USE_OUT",
  PRODUCTION_WASTE_OUT: "PRODUCTION_WASTE_OUT",
  ADJUSTMENT_IN: "ADJUSTMENT_IN",
  ADJUSTMENT_OUT: "ADJUSTMENT_OUT",
  REVERSAL: "REVERSAL",
};

let factoryStockTablePromise;
let canonicalFactoryStockCache = null;
let canonicalFactoryStockCachePromise = null;
const CANONICAL_FACTORY_STOCK_CACHE_TTL_MS = 15000;

export function invalidateFactoryStockCache() {
  canonicalFactoryStockCache = null;
  canonicalFactoryStockCachePromise = null;
}

export async function ensureFactoryStockTable() {
  if (typeof prisma.$executeRawUnsafe !== "function") return;
  if (!factoryStockTablePromise) {
    factoryStockTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "FactoryStockMovement" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "movementDate" TEXT NOT NULL,
          "movementType" TEXT NOT NULL,
          "stockType" TEXT NOT NULL DEFAULT 'BOTTLE',
          "productKey" TEXT NOT NULL,
          "productName" TEXT NOT NULL,
          "capacity" INTEGER NOT NULL DEFAULT 0,
          "quantityCards" INTEGER NOT NULL,
          "quantityBottles" INTEGER NOT NULL DEFAULT 0,
          "sourceType" TEXT,
          "sourceId" TEXT,
          "sourceVersion" TEXT,
          "reason" TEXT,
          "note" TEXT,
          "actorName" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FactoryStockMovement_movementDate_idx" ON "FactoryStockMovement"("movementDate")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FactoryStockMovement_stockType_movementDate_idx" ON "FactoryStockMovement"("stockType", "movementDate")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FactoryStockMovement_productKey_idx" ON "FactoryStockMovement"("productKey")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FactoryStockMovement_movementType_idx" ON "FactoryStockMovement"("movementType")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FactoryStockMovement_source_idx" ON "FactoryStockMovement"("sourceType", "sourceId")`);
    })().catch((error) => {
      factoryStockTablePromise = undefined;
      throw error;
    });
  }
  return factoryStockTablePromise;
}

export async function loadTubeMappings() {
  if (typeof prisma.priceSetting?.findMany !== "function") return new Map();
  const rows = await prisma.priceSetting.findMany({ where: { scope: "ITEM", tubeType: { not: null } }, select: { productKey: true, tubeType: true }, orderBy: [{ priceDate: "desc" }, { updatedAt: "desc" }] });
  const mappings = new Map();
  for (const row of rows) if (!mappings.has(row.productKey) && row.tubeType) mappings.set(row.productKey, row.tubeType);
  return mappings;
}

export async function loadDerivedFactoryStockMovements({ actorName = "system" } = {}) {
  // Some deployments intentionally use connection_limit=1. Keep these reads
  // sequential so stock pages and Trace Center do not queue competing pool
  // connections and time out while rebuilding derived movements.
  const productionRows = await prisma.productionReport.findMany({
    select: { reportDate: true, category: true, outputQuantity: true, outputCapacity: true, bottleType: true, tubeG: true, tubeColor: true, submissionId: true, notes: true, actorName: true, wasteQuantity: true, tubeDamageQuantity: true },
    orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }],
  });
  const ledgerRows = await prisma.ledger.findMany({
    where: { saleItems: { not: null } },
    select: { id: true, date: true, saleItems: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  const cashSales = await prisma.cashSale.findMany({
    where: { saleItems: { not: null } },
    select: { id: true, date: true, saleItems: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  const tubeMappings = await loadTubeMappings();
  return [
    ...productionMovementRows(productionRows, { actorName, tubeMappings }),
    ...saleMovementRows(ledgerRows, { actorName, sourceType: "LEDGER" }),
    ...saleMovementRows(cashSales, { actorName, sourceType: "CASH_SALE" }),
  ];
}

export async function loadCanonicalFactoryStockMovements({ actorName = "system" } = {}) {
  const now = Date.now();
  if (canonicalFactoryStockCache && now - canonicalFactoryStockCache.savedAt < CANONICAL_FACTORY_STOCK_CACHE_TTL_MS) {
    return canonicalFactoryStockCache.value;
  }
  if (canonicalFactoryStockCachePromise) return canonicalFactoryStockCachePromise;

  canonicalFactoryStockCachePromise = (async () => {
  const existing = typeof prisma.factoryStockMovement?.findMany === "function"
    ? await prisma.factoryStockMovement.findMany({ orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }, { id: "asc" }] })
    : [];
  const canLoadDerived = typeof prisma.productionReport?.findMany === "function"
    && typeof prisma.ledger?.findMany === "function"
    && typeof prisma.cashSale?.findMany === "function";
  const derived = canLoadDerived ? await loadDerivedFactoryStockMovements({ actorName }) : [];
  const movementKey = (movement) => [
    movement.sourceType,
    movement.sourceId,
    movement.movementType,
    movement.productKey,
    movement.quantityCards,
    movement.quantityBottles,
  ].map((value) => String(value ?? "")).join("|");
  // Derived records are the source of truth for production and sales. Do not
  // retain stale persisted sale rows after a transaction is edited/deleted or
  // after the cap-unit calculation changes. Manual stock adjustments remain.
  const derivedSourceTypes = new Set(["PRODUCTION", "TUBE_PRODUCTION", "BOTTLE_PRODUCTION", "BOTTLE_PRODUCTION_WASTE", "LEDGER", "CASH_SALE"]);
  const manualExisting = existing.filter((movement) => !derivedSourceTypes.has(movement.sourceType));
  const value = {
    movements: [...manualExisting, ...derived],
    dataSource: existing.length ? "MOVEMENT_LEDGER_PLUS_LIVE_DERIVED_STOCK" : "LIVE_DERIVED_FALLBACK",
  };
  canonicalFactoryStockCache = { savedAt: Date.now(), value };
  return value;
  })();

  try {
    return await canonicalFactoryStockCachePromise;
  } finally {
    canonicalFactoryStockCachePromise = null;
  }
}

function clean(value) {
  if (value instanceof Date) return value.toISOString();
  return String(value || "").trim();
}

export function isCapSaleItem(item) {
  return item?.isCap === true || item?.productType === "cap" || item?.categoryKey === "CAP";
}

export function normalizeCapacity(value) {
  const capacity = Math.round(Number(value || 0));
  return Number.isFinite(capacity) && capacity > 0 ? capacity : 0;
}

export function normalizeBottleIdentity({ productName, productKey, capacity }) {
  const rawName = clean(productName) || clean(productKey).split("::")[0] || "ဗူးမသတ်မှတ်ရသေး";
  const rawKey = clean(productKey);
  const keyCapacity = rawKey.includes("::") ? normalizeCapacity(rawKey.split("::").pop()) : 0;
  const normalizedCapacity = normalizeCapacity(capacity) || keyCapacity;
  return {
    productName: rawName,
    capacity: normalizedCapacity,
    productKey: `${rawName}::${normalizedCapacity}`,
  };
}

export function normalizeCapIdentity({ productName, productKey, location, packSize }) {
  const rawKey = clean(productKey);
  const rawName = clean(productName) || rawKey.split("::").pop() || "အဖုံး မသတ်မှတ်ရသေး";
  const capAliases = { CAP_WHITE: "ဖြူ", CAP_BLUE: "ပြာ", CAP_YELLOW: "ဝါ", CAP_GREEN: "စိမ်း", CAP_RED: "နီ", CAP_PINK: "ပန်း", CAP_BLACK: "နက်/အမဲ" };
  const aliasColor = capAliases[rawKey.toUpperCase()];
  const namedColor = rawName.replace(/^အဖုံး\s*[-·:]\s*/, "").trim();
  const color = aliasColor || namedColor || rawKey;
  const normalizedLocation = clean(location);
  const normalizedPackSize = positiveInteger(packSize);
  if (normalizedLocation && normalizedPackSize) {
    return { productName: `${normalizedLocation} · ${color}`, capacity: normalizedPackSize, productKey: `CAP::${normalizedLocation}::${color}::${normalizedPackSize}` };
  }
  return {
    productName: color,
    capacity: 0,
    productKey: `CAP::${color}`,
  };
}

function positiveInteger(value) {
  const number = Math.round(Number(value || 0));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function normalizeTubeIdentity(value, capacity = 0) {
  const raw = clean(value);
  const aliases = {
    "1 လီတာ ဖြူ": "24g W (အဖြူ)",
    "1 လီတာ ပြာ": "24g B (S+1)",
    ".3 ဖြူ": "13g W (အဖြူ)",
    ".3 ပြာ (S+S)": "13g (S+S)",
    ".3 B (S+1)": ".3 ပြာ (S+1)",
    "0.3 ပြာ (S+1)": ".3 ပြာ (S+1)",
  };
  const prefixAliases = [["24g W", "24g W (အဖြူ)"], ["24g B", "24g B (S+1)"], ["16g W", "16g W (အဖြူ)"], ["16g S+1", "16g (S+1)"], ["16g B", "16g B (S+S)"], ["13g W", "13g W (အဖြူ)"], ["13g S+1", "13g (S+1)"], ["13g S+S", "13g (S+S)"]];
  const fromPrefix = prefixAliases.find(([prefix]) => raw.startsWith(prefix))?.[1];
  const productName = aliases[raw] || fromPrefix || raw || "Tube မသတ်မှတ်ရသေး";
  const inferredCapacity = productName.startsWith("24g") ? 1500 : productName.startsWith("16g") ? 2000 : productName.startsWith("13g") || productName.startsWith(".3") ? 2500 : 0;
  const normalizedCapacity = normalizeCapacity(capacity) || inferredCapacity;
  return { productName, productKey: `${productName}::${normalizedCapacity}`, capacity: normalizedCapacity };
}

export function productionMovementRows(rows = [], { actorName = "system", sourceVersion = "v1", tubeMappings = new Map() } = {}) {
  const movements = [];
  for (const row of rows) {
    const cards = positiveInteger(row.outputQuantity);
    const capacity = normalizeCapacity(row.outputCapacity);
    const reportId = clean(row.submissionId);
    if (!cards || !capacity || !reportId) continue;
    if (row.category === "tube" && clean(row.tubeG)) {
      const identity = normalizeTubeIdentity(`${row.tubeG} ${row.tubeColor || ""}`, capacity);
      movements.push({ movementDate: clean(row.reportDate), movementType: MOVEMENT_TYPES.PRODUCTION_IN, stockType: STOCK_TYPES.TUBE, ...identity, quantityCards: cards, quantityBottles: cards * capacity, sourceType: "TUBE_PRODUCTION", sourceId: reportId, sourceVersion, reason: "Tube ထုတ်လုပ်မှုမှတ်တမ်း", note: clean(row.notes) || null, actorName: clean(actorName) || "system" });
      continue;
    }
    if (row.category !== "tube" && clean(row.bottleType)) {
      const bottleIdentity = normalizeBottleIdentity({ productName: row.bottleType, capacity });
      const wastePieces = positiveInteger(row.wasteQuantity);
      movements.push({ movementDate: clean(row.reportDate), movementType: MOVEMENT_TYPES.PRODUCTION_IN, stockType: STOCK_TYPES.BOTTLE, ...bottleIdentity, quantityCards: cards, quantityBottles: cards * capacity, sourceType: "PRODUCTION", sourceId: reportId, sourceVersion, reason: "ထုတ်လုပ်မှုမှတ်တမ်း", note: clean(row.notes) || null, actorName: clean(actorName) || "system" });
      const mapped = tubeMappings.get(bottleIdentity.productKey);
      if (mapped) {
        const tubeIdentity = normalizeTubeIdentity(mapped, 0);
        const outputPieces = cards * capacity;
        const tubeDamagePieces = positiveInteger(row.tubeDamageQuantity);
        const totalTubeUse = outputPieces + wastePieces + tubeDamagePieces;
        movements.push({ movementDate: clean(row.reportDate), movementType: MOVEMENT_TYPES.PRODUCTION_USE_OUT, stockType: STOCK_TYPES.TUBE, ...tubeIdentity, quantityCards: 0, quantityBottles: -totalTubeUse, sourceType: "BOTTLE_PRODUCTION", sourceId: reportId, sourceVersion, reason: "ဗူးထုတ်လုပ်ရာတွင် Tube သုံးစွဲ (ကောင်း/ဗူးပျက်/Tube ပျက်)", note: `${bottleIdentity.productName} ${capacity} ဆံ့`, actorName: clean(actorName) || "system" });
      }
      // Bottle waste is recorded for traceability only. It is not deducted
      // from good-bottle stock because outputQuantity already represents the
      // good bottles added to stock.
      if (wastePieces) movements.push({ movementDate: clean(row.reportDate), movementType: MOVEMENT_TYPES.PRODUCTION_WASTE_OUT, stockType: STOCK_TYPES.BOTTLE, ...bottleIdentity, quantityCards: 0, quantityBottles: 0, sourceType: "BOTTLE_PRODUCTION_WASTE", sourceId: reportId, sourceVersion, reason: "ဗူးပျက် သီးခြားမှတ်တမ်း", note: `${wastePieces} ဗူးပျက် · ဗူးလက်ကျန်မှ မနုတ်`, actorName: clean(actorName) || "system" });
    }
  }
  return movements;
}
export function saleMovementRows(rows = [], { actorName = "system", sourceType = "SALE", sourceVersion = "v1" } = {}) {
  const movements = [];
  for (const row of rows) {
    if (!Array.isArray(row.saleItems)) continue;
    for (const item of row.saleItems) {
      if (isCapSaleItem(item)) {
        const capCount = positiveInteger(item?.cardCount || item?.unitCount || item?.bottleCount);
        if (!capCount) continue;
        const identity = normalizeCapIdentity({ productName: item?.productName, productKey: item?.productKey, location: item?.capLocation, packSize: item?.capPackSize });
        movements.push({ movementDate: getMyanmarDateInputValue(row.date), movementType: MOVEMENT_TYPES.SALE_OUT, stockType: STOCK_TYPES.CAP, ...identity, quantityCards: -capCount, quantityBottles: 0, sourceType, sourceId: clean(row.id), sourceVersion, reason: "အဖုံးရောင်းစာရင်း", note: null, actorName: clean(actorName) || "system" });
        continue;
      }
      const isTube = item?.productType === "tube" || item?.categoryKey === "TUBE";
      const noCap = item?.capLocation === "အဖုံးမပါ" || item?.capDeliveryMode === "NONE";
      const bottleCount = positiveInteger(item?.bottleCount);
      const capacity = normalizeCapacity(item?.capacity || item?.bottlesPerCard);
      const cards = positiveInteger(item?.cardCount) || (capacity ? Math.floor(bottleCount / capacity) : 0);
      if (!bottleCount && !cards) continue;
      const identity = isTube
        ? normalizeTubeIdentity(item?.productName || item?.tubeType, capacity)
        : normalizeBottleIdentity({ productName: item?.productName, productKey: item?.productKey, capacity });
      movements.push({
        movementDate: getMyanmarDateInputValue(row.date),
        movementType: MOVEMENT_TYPES.SALE_OUT,
        stockType: isTube ? STOCK_TYPES.TUBE : STOCK_TYPES.BOTTLE,
        ...identity,
        quantityCards: -cards,
        quantityBottles: -(bottleCount || cards * identity.capacity),
        sourceType,
        sourceId: clean(row.id),
        sourceVersion,
        reason: "ဗူးရောင်းစာရင်း",
        note: null,
        actorName: clean(actorName) || "system",
      });
      if (noCap) continue;
      const capBreakdown = Array.isArray(item?.capBreakdown) ? item.capBreakdown : [];
      if (capBreakdown.length) {
        for (const capEntry of capBreakdown) {
          const capCount = positiveInteger(capEntry?.count);
          if (!capCount || !clean(capEntry?.capProductKey)) continue;
          const capIdentity = normalizeCapIdentity({ productName: capEntry?.capProductName, productKey: capEntry.capProductKey, location: capEntry?.capLocation || item?.capLocation, packSize: item?.capPackSize });
          movements.push({ movementDate: getMyanmarDateInputValue(row.date), movementType: MOVEMENT_TYPES.SALE_OUT, stockType: STOCK_TYPES.CAP, ...capIdentity, quantityCards: 0, quantityBottles: -capCount, sourceType, sourceId: clean(row.id), sourceVersion, reason: "ဗူးရောင်းရာတွင် အဖုံးသုံးစွဲ", note: "အရောင်အလိုက် ခွဲယူမှု", actorName: clean(actorName) || "system" });
        }
      } else {
        const capCount = positiveInteger(item?.capNormalCount) + positiveInteger(item?.capExtraCount);
        if (capCount && clean(item?.capProductKey)) {
          const capIdentity = normalizeCapIdentity({ productName: item?.capProductName, productKey: item.capProductKey, location: item?.capLocation, packSize: item?.capPackSize });
          movements.push({ movementDate: getMyanmarDateInputValue(row.date), movementType: MOVEMENT_TYPES.SALE_OUT, stockType: STOCK_TYPES.CAP, ...capIdentity, quantityCards: 0, quantityBottles: -capCount, sourceType, sourceId: clean(row.id), sourceVersion, reason: "ဗူးရောင်းရာတွင် အဖုံးသုံးစွဲ", note: `ပုံမှန် ${positiveInteger(item?.capNormalCount)} + အပို ${positiveInteger(item?.capExtraCount)}`, actorName: clean(actorName) || "system" });
        }
      }
    }
  }
  return movements.filter((row) => row.sourceId && (row.quantityCards < 0 || (row.stockType === STOCK_TYPES.CAP && row.quantityBottles < 0)));
}

export function aggregateStockMovements(movements = []) {
  const summary = new Map();
  for (const movement of movements) {
    const current = summary.get(movement.productKey) || {
      productKey: movement.productKey,
      stockType: movement.stockType,
      productName: movement.productName,
      capacity: movement.capacity,
      productionCards: 0,
      soldCards: 0,
      adjustmentCards: 0,
      currentCards: 0,
      productionBottles: 0,
      soldBottles: 0,
      usedBottles: 0,
      usedCards: 0,
      adjustmentBottles: 0,
      wastedBottles: 0,
      currentBottles: 0,
    };
    const cards = Number(movement.quantityCards || 0);
    const storedBottles = Number(movement.quantityBottles || 0);
    // Legacy manual cap-opening rows stored only bag count. Reconstruct their
    // piece count from the pack size so Dashboard and Cap Stock stay aligned.
    const bottles = movement.stockType === STOCK_TYPES.CAP && storedBottles === 0 && cards !== 0
      ? cards * Number(movement.capacity || 1)
      : storedBottles;
    current.currentCards += cards;
    current.currentBottles += bottles;
    if (movement.movementType === MOVEMENT_TYPES.PRODUCTION_IN) {
      current.productionCards += cards;
      current.productionBottles += bottles;
    } else if (movement.movementType === MOVEMENT_TYPES.SALE_OUT) {
      current.soldCards += Math.abs(cards);
      current.soldBottles += Math.abs(bottles);
    } else if (movement.movementType === MOVEMENT_TYPES.PRODUCTION_USE_OUT) {
      current.usedCards += Math.abs(cards);
      current.usedBottles += Math.abs(bottles);
    } else if (movement.movementType === MOVEMENT_TYPES.PRODUCTION_WASTE_OUT) {
      current.wastedBottles += Math.abs(bottles);
    } else {
      current.adjustmentCards += cards;
      current.adjustmentBottles += bottles;
    }
    summary.set(movement.productKey, current);
  }
  return [...summary.values()].map((item) => {
    const systemCurrentBottles = item.currentBottles;
    // Cap quantities are stored as individual pieces. Convert to bags only
    // for display/aggregation using the configured pack size (e.g. 5000).
    const capUnit = item.stockType === STOCK_TYPES.CAP && Number(item.capacity || 0) > 0 ? Number(item.capacity) : 1;
    const systemCurrentCards = item.stockType === STOCK_TYPES.CAP ? systemCurrentBottles / capUnit : item.currentCards;
    const soldCards = item.stockType === STOCK_TYPES.CAP ? item.soldBottles / capUnit : item.soldCards;
    const adjustmentCards = item.stockType === STOCK_TYPES.CAP ? item.adjustmentBottles / capUnit : item.adjustmentCards;
    const unrecordedOpeningStockCards = Math.max(0, -systemCurrentCards);
    const unrecordedOpeningStockBottles = Math.max(0, -systemCurrentBottles);
    return {
      ...item,
      systemCurrentCards,
      systemCurrentBottles,
      soldCards,
      adjustmentCards,
      openingStockCards: 0,
      openingStockBottles: 0,
      unrecordedOpeningStockCards,
      unrecordedOpeningStockBottles,
      currentCards: systemCurrentCards,
      currentBottles: systemCurrentBottles,
    };
  }).sort((a, b) => a.productName.localeCompare(b.productName, "my"));
}

export function reversalMovementRows(movements = [], { actorName = "system", sourceVersion = "reversal-v1" } = {}) {
  return movements.map((movement) => ({
    movementDate: movement.movementDate,
    movementType: MOVEMENT_TYPES.REVERSAL,
    stockType: movement.stockType,
    productKey: movement.productKey,
    productName: movement.productName,
    capacity: movement.capacity,
    quantityCards: -Number(movement.quantityCards || 0),
    quantityBottles: -Number(movement.quantityBottles || 0),
    sourceType: movement.sourceType,
    sourceId: movement.sourceId,
    sourceVersion,
    reason: `${movement.reason || "Stock movement"} ပြန်လှန်ခြင်း`,
    note: movement.note || null,
    actorName: clean(actorName) || "system",
  }));
}

export async function loadFactoryStockMovements(where = {}) {
  return prisma.factoryStockMovement.findMany({ where, orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }, { id: "asc" }] });
}
