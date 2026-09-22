import { prisma } from "@/lib/prisma";
import { calculatePackagingBags, packagingRuleFor, BAG_RULES } from "@/lib/packaging-bag-calculator";

export const PACKAGING_BAG_STOCK_TYPE = "PACKAGING_BAG";
export const PACKAGING_BAG_OPENING_SOURCE = "PACKAGING_BAG_OPENING";

function clean(value) { return String(value || "").trim(); }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")); }

export function packagingBagNames() {
  return BAG_RULES.map((rule) => rule.bagSize);
}

export async function loadPackagingBagStock({ date = "", includeMovements = true } = {}) {
  if (typeof prisma.productionReport?.findMany !== "function" || typeof prisma.factoryStockMovement?.findMany !== "function") {
    return { summary: BAG_RULES.map((rule) => ({ bagSize: rule.bagSize, addedBags: 0, usedBags: 0, currentBags: 0, systemCurrentBags: 0 })), movements: [], dailyUsed: [], dailyAdded: [], productionResult: { groups: [], unassigned: [], totalBags: 0, totalPieces: 0 }, totalAddedBags: 0, totalUsedBags: 0, totalCurrentBags: 0 };
  }
  const allProductionRows = await prisma.productionReport.findMany({
    where: { category: "bottle" },
    select: { id: true, reportDate: true, outputQuantity: true, outputCapacity: true, bottleType: true, outputUnit: true },
    orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }],
  });
  const productionResult = calculatePackagingBags(allProductionRows);
  const manualMovements = await prisma.factoryStockMovement.findMany({
    where: { stockType: PACKAGING_BAG_STOCK_TYPE },
    orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  const usageMovements = [];
  for (const row of allProductionRows) {
    const rule = packagingRuleFor(row);
    const quantity = Number(row.outputQuantity || 0);
    if (!rule || quantity <= 0) continue;
    usageMovements.push({
      id: `usage-${row.id}`,
      movementDate: row.reportDate,
      movementType: "PRODUCTION_USE_OUT",
      stockType: PACKAGING_BAG_STOCK_TYPE,
      productKey: `BAG::${rule.bagSize}`,
      productName: `${rule.bagSize} အိတ်`,
      capacity: 1,
      quantityCards: -quantity,
      quantityBottles: -quantity,
      sourceType: "BOTTLE_PRODUCTION_PACKAGING",
      sourceId: row.id,
      reason: "ဗူးထုတ်လုပ်ပြီး ထုပ်ပိုးရာတွင် အိတ်ခွံသုံးစွဲ",
      note: `${row.bottleType || "ဗူး"} ${row.outputCapacity || ""} ဆံ့`,
      actorName: "system",
    });
  }
  const allMovements = [...manualMovements, ...usageMovements];
  const grouped = new Map(BAG_RULES.map((rule) => [rule.bagSize, { bagSize: rule.bagSize, addedBags: 0, usedBags: 0, currentBags: 0, systemCurrentBags: 0 }]));
  for (const movement of allMovements) {
    const bagSize = clean(movement.productKey).replace(/^BAG::/, "") || clean(movement.productName).replace(/ အိတ်$/, "");
    if (!grouped.has(bagSize)) grouped.set(bagSize, { bagSize, addedBags: 0, usedBags: 0, currentBags: 0, systemCurrentBags: 0 });
    const item = grouped.get(bagSize);
    const quantity = Number(movement.quantityBottles || movement.quantityCards || 0);
    if (quantity >= 0) item.addedBags += quantity;
    else item.usedBags += Math.abs(quantity);
    item.systemCurrentBags += quantity;
  }
  const summary = [...grouped.values()].map((item) => ({ ...item, currentBags: Math.max(0, item.systemCurrentBags) }));
  const selectedDate = validDate(date) ? date : "";
  const dailyUsed = usageMovements.filter((movement) => !selectedDate || movement.movementDate === selectedDate);
  const dailyAdded = manualMovements.filter((movement) => !selectedDate || movement.movementDate === selectedDate);
  const movements = includeMovements ? [...allMovements].sort((a, b) => String(b.movementDate).localeCompare(String(a.movementDate)) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""))) : [];
  return {
    summary,
    movements,
    dailyUsed,
    dailyAdded,
    productionResult,
    totalAddedBags: summary.reduce((sum, item) => sum + item.addedBags, 0),
    totalUsedBags: summary.reduce((sum, item) => sum + item.usedBags, 0),
    totalCurrentBags: summary.reduce((sum, item) => sum + item.currentBags, 0),
  };
}

export function packagingBagMovement({ bagSize, bags, date, note, actorName }) {
  const normalizedBagSize = clean(bagSize);
  const quantity = Math.round(Number(bags || 0));
  if (!packagingBagNames().includes(normalizedBagSize)) throw new Error("အိတ်ခွံအရွယ်အစား မမှန်ပါ။");
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("အိတ်အရေအတွက်ကို အပေါင်းကိန်း ထည့်ပေးပါ။");
  if (!validDate(date)) throw new Error("ရက်စွဲပုံစံ မမှန်ပါ။");
  const sourceId = `PACKAGING_BAG_${crypto.randomUUID()}`;
  return {
    movementDate: date,
    movementType: "ADJUSTMENT_IN",
    stockType: PACKAGING_BAG_STOCK_TYPE,
    productKey: `BAG::${normalizedBagSize}`,
    productName: `${normalizedBagSize} အိတ်`,
    capacity: 1,
    quantityCards: quantity,
    quantityBottles: quantity,
    sourceType: PACKAGING_BAG_OPENING_SOURCE,
    sourceId,
    sourceVersion: "packaging-bag-stock-v1",
    reason: "စက်ရုံ ထုပ်ပိုး အိတ်ခွံ အသစ်ဝင် / လက်ရှိ Stock ထည့်ခြင်း",
    note: clean(note) || null,
    actorName: clean(actorName) || "system",
  };
}
