import { prisma } from "@/lib/prisma";
import { ensureFactoryStockTable, invalidateFactoryStockCache, MOVEMENT_TYPES, STOCK_TYPES } from "@/lib/factory-stock";
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";

export const GLUE_STOCK_TYPE = "GLUE";
const GLUE_PRODUCT_KEY = "GLUE::MAIN";
const GLUE_PRODUCT_NAME = "ကော်စေ့";

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positive(value) {
  const parsed = number(value);
  return parsed > 0 ? parsed : 0;
}

function clean(value) {
  return String(value || "").trim();
}

function manualMovement(row) {
  return {
    ...row,
    stockType: GLUE_STOCK_TYPE,
    productKey: GLUE_PRODUCT_KEY,
    productName: GLUE_PRODUCT_NAME,
    quantityCards: number(row.quantityCards),
    quantityBottles: number(row.quantityBottles),
  };
}

async function loadGlueMovements({ includeDerived = true } = {}) {
  await ensureFactoryStockTable();
  const manualRows = typeof prisma.factoryStockMovement?.findMany === "function"
    ? await prisma.factoryStockMovement.findMany({
      where: { stockType: GLUE_STOCK_TYPE },
      orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    })
    : [];
  const movements = manualRows.map(manualMovement);
  if (!includeDerived) return movements;

  if (typeof prisma.productionReport?.findMany !== "function") return movements;
  const productionRows = await prisma.productionReport.findMany({
    where: { category: "tube" },
    select: { id: true, reportDate: true, tubeMetrics: true, actorName: true },
    orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }],
  });
  for (const row of productionRows) {
    const metrics = row.tubeMetrics && typeof row.tubeMetrics === "object" ? row.tubeMetrics : {};
    const usedKg = positive(metrics.usedGlueKg);
    const usedBags = positive(metrics.usedGlueBags);
    if (!usedKg && !usedBags) continue;
    movements.push({
      id: `derived-glue-${row.id}`,
      movementDate: getMyanmarDateInputValue(row.reportDate),
      movementType: MOVEMENT_TYPES.PRODUCTION_USE_OUT,
      stockType: GLUE_STOCK_TYPE,
      productKey: GLUE_PRODUCT_KEY,
      productName: GLUE_PRODUCT_NAME,
      capacity: 0,
      quantityCards: -usedBags,
      quantityBottles: -usedKg,
      sourceType: "TUBE_PRODUCTION_GLUE",
      sourceId: row.id,
      sourceVersion: "tube-metrics-v1",
      reason: "Tube ထုတ်လုပ်မှုတွင် ကော်စေ့သုံးစွဲမှု",
      note: null,
      actorName: clean(row.actorName) || "system",
      createdAt: null,
      derived: true,
    });
  }
  return movements.sort((a, b) => String(a.movementDate || "").localeCompare(String(b.movementDate || "")) || new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
}

export async function loadGlueStock({ date = getMyanmarDateInputValue(), includeMovements = true } = {}) {
  const movements = await loadGlueMovements();
  const currentKg = movements.reduce((sum, row) => sum + number(row.quantityBottles), 0);
  const currentBags = movements.reduce((sum, row) => sum + number(row.quantityCards), 0);
  const totalAddedKg = movements.filter((row) => row.quantityBottles > 0).reduce((sum, row) => sum + number(row.quantityBottles), 0);
  const totalAddedBags = movements.filter((row) => row.quantityCards > 0).reduce((sum, row) => sum + number(row.quantityCards), 0);
  const dailyUsed = movements.filter((row) => row.movementDate === date && row.quantityBottles < 0);
  const dailyAdded = movements.filter((row) => row.movementDate === date && row.quantityBottles > 0);
  const serialize = (row) => ({
    ...row,
    quantityCards: number(row.quantityCards),
    quantityBottles: number(row.quantityBottles),
  });
  return {
    date,
    currentKg: Math.max(0, currentKg),
    currentBags: Math.max(0, currentBags),
    systemCurrentKg: currentKg,
    systemCurrentBags: currentBags,
    totalAddedKg,
    totalAddedBags,
    dailyUsedKg: Math.abs(dailyUsed.reduce((sum, row) => sum + number(row.quantityBottles), 0)),
    dailyUsedBags: Math.abs(dailyUsed.reduce((sum, row) => sum + number(row.quantityCards), 0)),
    dailyAddedKg: dailyAdded.reduce((sum, row) => sum + number(row.quantityBottles), 0),
    dailyAddedBags: dailyAdded.reduce((sum, row) => sum + number(row.quantityCards), 0),
    movements: includeMovements ? movements.slice().reverse().map(serialize) : [],
  };
}

export function glueStockAddition({ date, kg, bags, note, actorName }) {
  const amountKg = positive(kg);
  const amountBags = positive(bags);
  if (!amountKg && !amountBags) throw new Error("ကော်စေ့ kg သို့မဟုတ် အိတ် အနည်းဆုံးတစ်ခု ထည့်ပေးပါ။");
  return {
    movementDate: clean(date) || getMyanmarDateInputValue(),
    movementType: MOVEMENT_TYPES.ADJUSTMENT_IN,
    stockType: GLUE_STOCK_TYPE,
    productKey: GLUE_PRODUCT_KEY,
    productName: GLUE_PRODUCT_NAME,
    capacity: 0,
    quantityCards: amountBags,
    quantityBottles: amountKg,
    sourceType: "GLUE_OPENING",
    sourceId: `GLUE_STOCK_${crypto.randomUUID()}`,
    sourceVersion: "glue-opening-v1",
    reason: "စက်ရုံ ကော်စေ့ Stock အသစ်ထည့်ခြင်း",
    note: clean(note) || null,
    actorName: clean(actorName) || "system",
  };
}

export { GLUE_PRODUCT_KEY, GLUE_PRODUCT_NAME, invalidateFactoryStockCache };
