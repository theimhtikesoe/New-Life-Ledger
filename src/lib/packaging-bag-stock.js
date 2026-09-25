import { prisma } from "@/lib/prisma";
import { calculatePackagingBags, packagingRuleFor, packagingRuleForSize, packagingPiecesFromSacks, packagingSacksFromPieces, BAG_RULES } from "@/lib/packaging-bag-calculator";

export const PACKAGING_BAG_STOCK_TYPE = "PACKAGING_BAG";
export const PACKAGING_BAG_OPENING_SOURCE = "PACKAGING_BAG_OPENING";
export const PACKAGING_BAG_STOCK_VERSION = "packaging-bag-stock-v2-pieces";

function clean(value) { return String(value || "").trim(); }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")); }
function number(value) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function ruleForSize(size) { return BAG_RULES.find((rule) => rule.bagSize === size) || null; }
function sizeFromMovement(movement) {
  return clean(movement.productKey).replace(/^BAG::/, "") || clean(movement.productName).replace(/ (?:အိတ်|လုံး)$/, "");
}
function piecesFromManualMovement(movement, rule) {
  const raw = number(movement.quantityBottles || movement.quantityCards);
  return movement.sourceVersion === PACKAGING_BAG_STOCK_VERSION ? raw : raw * Number(rule?.piecesPerBag || 1);
}

export function packagingBagNames() { return BAG_RULES.map((rule) => rule.bagSize); }

export async function loadPackagingBagStock({ date = "", includeMovements = true } = {}) {
  if (typeof prisma.productionReport?.findMany !== "function" || typeof prisma.factoryStockMovement?.findMany !== "function") {
    return { summary: BAG_RULES.map((rule) => ({ bagSize: rule.bagSize, addedPieces: 0, usedPieces: 0, currentPieces: 0, systemCurrentPieces: 0, piecesPerBag: rule.piecesPerBag, weightLb: rule.weightLb, packsPerSack: rule.packsPerSack, piecesPerSack: rule.piecesPerSack, sackWeightLb: rule.sackWeightLb, sacks: 0, remainderPieces: 0 })), movements: [], dailyUsed: [], dailyAdded: [], productionResult: { groups: [], unassigned: [], totalBags: 0, totalPieces: 0, totalPackagingPieces: 0, totalPackagingWeightLb: 0 }, totalAddedPieces: 0, totalUsedPieces: 0, totalCurrentPieces: 0, totalAddedBags: 0, totalUsedBags: 0, totalCurrentBags: 0 };
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
    const quantity = number(row.outputQuantity);
    if (!rule || quantity <= 0) continue;
    // Factory stock is consumed by output card: one bottle-output card uses one
    // packaging-bag piece. The rule's piecesPerBag is only for the 100-lb Sala
    // reference conversion, not for production stock deductions.
    const pieces = quantity;
    usageMovements.push({
      id: `usage-${row.id}`,
      movementDate: row.reportDate,
      movementType: "PRODUCTION_USE_OUT",
      stockType: PACKAGING_BAG_STOCK_TYPE,
      productKey: `BAG::${rule.bagSize}`,
      productName: `${rule.bagSize} လုံး`,
      capacity: 1,
      quantityCards: -pieces,
      quantityBottles: -pieces,
      sourceType: "BOTTLE_PRODUCTION_PACKAGING",
      sourceId: row.id,
      sourceVersion: PACKAGING_BAG_STOCK_VERSION,
      reason: "ဗူးထုတ်လုပ်ပြီး ထုပ်ပိုးရာတွင် အိတ်ခွံလုံး သုံးစွဲ",
      note: `${row.bottleType || "ဗူး"} ${row.outputCapacity || ""} ဆံ့ · ဗူးကဒ် ၁ ကဒ် = အိတ်ခွံ ၁ လုံး`,
      actorName: "system",
      derived: true,
    });
  }
  const allMovements = [
    ...manualMovements.map((movement) => {
      const size = sizeFromMovement(movement);
      const rule = ruleForSize(size);
      const pieces = piecesFromManualMovement(movement, rule);
      return { ...movement, productName: `${size} လုံး`, quantityCards: pieces, quantityBottles: pieces, legacyBagCount: movement.sourceVersion === PACKAGING_BAG_STOCK_VERSION ? 0 : number(movement.quantityBottles || movement.quantityCards) };
    }),
    ...usageMovements,
  ];
  const grouped = new Map(BAG_RULES.map((rule) => [rule.bagSize, { bagSize: rule.bagSize, label: rule.label, piecesPerBag: rule.piecesPerBag, weightLb: rule.weightLb, addedPieces: 0, usedPieces: 0, currentPieces: 0, systemCurrentPieces: 0 }]));
  for (const movement of allMovements) {
    const bagSize = sizeFromMovement(movement);
    const rule = ruleForSize(bagSize);
    if (!grouped.has(bagSize)) grouped.set(bagSize, { bagSize, label: bagSize, piecesPerBag: rule?.piecesPerBag || 1, weightLb: rule?.weightLb || 0, addedPieces: 0, usedPieces: 0, currentPieces: 0, systemCurrentPieces: 0 });
    const item = grouped.get(bagSize);
    const quantity = number(movement.quantityBottles || movement.quantityCards);
    if (quantity >= 0) item.addedPieces += quantity;
    else item.usedPieces += Math.abs(quantity);
    item.systemCurrentPieces += quantity;
  }
  const summary = [...grouped.values()].map((item) => ({
    ...item,
    currentPieces: Math.max(0, item.systemCurrentPieces),
    packsPerSack: packagingRuleForSize(item.bagSize)?.packsPerSack || 0,
    piecesPerSack: packagingRuleForSize(item.bagSize)?.piecesPerSack || 0,
    sackWeightLb: packagingRuleForSize(item.bagSize)?.sackWeightLb || 100,
    ...packagingSacksFromPieces(item.bagSize, Math.max(0, item.systemCurrentPieces)),
    addedBags: item.addedPieces / item.piecesPerBag,
    usedBags: item.usedPieces / item.piecesPerBag,
    currentBags: Math.max(0, item.systemCurrentPieces) / item.piecesPerBag,
    systemCurrentBags: item.systemCurrentPieces / item.piecesPerBag,
  }));
  const selectedDate = validDate(date) ? date : "";
  const dailyUsed = usageMovements.filter((movement) => !selectedDate || movement.movementDate === selectedDate);
  const dailyAdded = allMovements.filter((movement) => !movement.derived && (!selectedDate || movement.movementDate === selectedDate));
  const movements = includeMovements ? [...allMovements].sort((a, b) => String(b.movementDate).localeCompare(String(a.movementDate)) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""))) : [];
  return {
    summary,
    movements,
    dailyUsed,
    dailyAdded,
    productionResult,
    totalAddedPieces: summary.reduce((sum, item) => sum + item.addedPieces, 0),
    totalUsedPieces: summary.reduce((sum, item) => sum + item.usedPieces, 0),
    totalCurrentPieces: summary.reduce((sum, item) => sum + item.currentPieces, 0),
    totalAddedBags: summary.reduce((sum, item) => sum + item.addedBags, 0),
    totalUsedBags: summary.reduce((sum, item) => sum + item.usedBags, 0),
    totalCurrentBags: summary.reduce((sum, item) => sum + item.currentBags, 0),
  };
}

export function packagingBagMovement({ bagSize, bags, pieces, sacks, extraPieces, date, note, actorName }) {
  const normalizedBagSize = clean(bagSize);
  const rule = ruleForSize(normalizedBagSize);
  const sackPieces = sacks === undefined || sacks === null || sacks === "" ? 0 : packagingPiecesFromSacks(normalizedBagSize, sacks).pieces;
  const inputPieces = sacks !== undefined && sacks !== null && sacks !== ""
    ? sackPieces + number(extraPieces)
    : pieces === undefined || pieces === null || pieces === ""
      ? number(bags) * Number(rule?.piecesPerBag || 1)
      : number(pieces);
  const quantity = Math.round(inputPieces);
  if (!packagingBagNames().includes(normalizedBagSize)) throw new Error("အိတ်ခွံအရွယ်အစား မမှန်ပါ။");
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("အိတ်ခွံလုံးအရေအတွက်ကို အပေါင်းကိန်း ထည့်ပေးပါ။");
  if (!validDate(date)) throw new Error("ရက်စွဲပုံစံ မမှန်ပါ။");
  const sourceId = `PACKAGING_BAG_${crypto.randomUUID()}`;
  return {
    movementDate: date,
    movementType: "ADJUSTMENT_IN",
    stockType: PACKAGING_BAG_STOCK_TYPE,
    productKey: `BAG::${normalizedBagSize}`,
    productName: `${normalizedBagSize} လုံး`,
    capacity: 1,
    quantityCards: quantity,
    quantityBottles: quantity,
    sourceType: PACKAGING_BAG_OPENING_SOURCE,
    sourceId,
    sourceVersion: PACKAGING_BAG_STOCK_VERSION,
    reason: "စက်ရုံ ထုပ်ပိုးအိတ်ခွံလုံး အသစ်ဝင် / လက်ရှိ Stock ထည့်ခြင်း",
    note: clean(note) || null,
    actorName: clean(actorName) || "system",
  };
}
