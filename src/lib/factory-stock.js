import { prisma } from "@/lib/prisma";

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
      await Promise.all([
        prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FactoryStockMovement_movementDate_idx" ON "FactoryStockMovement"("movementDate")`),
        prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FactoryStockMovement_productKey_idx" ON "FactoryStockMovement"("productKey")`),
        prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FactoryStockMovement_movementType_idx" ON "FactoryStockMovement"("movementType")`),
        prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FactoryStockMovement_source_idx" ON "FactoryStockMovement"("sourceType", "sourceId")`),
      ]);
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
  const [productionRows, ledgerRows, cashSales] = await Promise.all([
    prisma.productionReport.findMany({
      select: { reportDate: true, category: true, outputQuantity: true, outputCapacity: true, bottleType: true, tubeG: true, tubeColor: true, submissionId: true, notes: true, actorName: true, wasteQuantity: true, tubeDamageQuantity: true },
      orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.ledger.findMany({
      where: { saleItems: { not: null } },
      select: { id: true, date: true, saleItems: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.cashSale.findMany({
      where: { saleItems: { not: null } },
      select: { id: true, date: true, saleItems: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
  ]);
  const tubeMappings = await loadTubeMappings();
  return [
    ...productionMovementRows(productionRows, { actorName, tubeMappings }),
    ...saleMovementRows(ledgerRows, { actorName, sourceType: "LEDGER" }),
    ...saleMovementRows(cashSales, { actorName, sourceType: "CASH_SALE" }),
  ];
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
  };
  const prefixAliases = [["24g W", "24g W (အဖြူ)"], ["24g B", "24g B (S+1)"], ["16g W", "16g W (အဖြူ)"], ["16g S+1", "16g (S+1)"], ["13g W", "13g W (အဖြူ)"], ["13g S+1", "13g (S+1)"], ["13g S+S", "13g (S+S)"]];
  const fromPrefix = prefixAliases.find(([prefix]) => raw.startsWith(prefix))?.[1];
  const productName = aliases[raw] || fromPrefix || raw || "Tube မသတ်မှတ်ရသေး";
  const inferredCapacity = productName.startsWith("24g") ? 1500 : productName.startsWith("16g") ? 2000 : productName.startsWith("13g") ? 2500 : 0;
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
      if (wastePieces) movements.push({ movementDate: clean(row.reportDate), movementType: MOVEMENT_TYPES.PRODUCTION_WASTE_OUT, stockType: STOCK_TYPES.BOTTLE, ...bottleIdentity, quantityCards: 0, quantityBottles: -wastePieces, sourceType: "BOTTLE_PRODUCTION_WASTE", sourceId: reportId, sourceVersion, reason: "ဗူးပျက်/အရည်အသွေးမပြည့်မီ ဗူးနုတ်", note: clean(row.notes) || null, actorName: clean(actorName) || "system" });
    }
  }
  return movements;
}
export function saleMovementRows(rows = [], { actorName = "system", sourceType = "SALE", sourceVersion = "v1" } = {}) {
  const movements = [];
  for (const row of rows) {
    if (!Array.isArray(row.saleItems)) continue;
    for (const item of row.saleItems) {
      if (isCapSaleItem(item)) continue;
      const bottleCount = positiveInteger(item?.bottleCount);
      const capacity = normalizeCapacity(item?.capacity || item?.bottlesPerCard);
      const cards = positiveInteger(item?.cardCount) || (capacity ? Math.floor(bottleCount / capacity) : 0);
      if (!bottleCount && !cards) continue;
      const identity = normalizeBottleIdentity({ productName: item?.productName, productKey: item?.productKey, capacity });
      movements.push({
        movementDate: clean(row.date).slice(0, 10),
        movementType: MOVEMENT_TYPES.SALE_OUT,
        stockType: STOCK_TYPES.BOTTLE,
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
    }
  }
  return movements.filter((row) => row.sourceId && row.quantityCards < 0);
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
    const bottles = Number(movement.quantityBottles || 0);
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
  return [...summary.values()].sort((a, b) => a.productName.localeCompare(b.productName, "my"));
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
