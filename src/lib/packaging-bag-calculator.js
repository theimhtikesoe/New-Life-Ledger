export const SALA_SACK_WEIGHT_LB = 100;

const BAG_RULES = [
  { bagSize: "38×58", label: "38×58", piecesPerBag: 20, weightLb: 1.15, matches: ["03", "liter", "09", "06", "cow", "30"] },
  { bagSize: "38×40", label: "38×40", piecesPerBag: 28, weightLb: 4.16, matches: ["liter-white-100", "liter-round", "engine-oil"] },
  { bagSize: "38×38", label: "38×38", piecesPerBag: 28, weightLb: 1.17, matches: ["09-100", "08-white-250", "03-white-200"] },
  { bagSize: "37×37", label: "37×37", piecesPerBag: 36, weightLb: 1.13, matches: ["085-100", "gold-200", "025-200", "25-210"] },
  { bagSize: "35×35", label: "35×35", piecesPerBag: 52, weightLb: 1.17, matches: ["cow-100", "06-100", "06-round-100"] },
  { bagSize: "31×31", label: "31×31", piecesPerBag: 40, weightLb: 1.16, matches: ["08-100", "30-100", "025-100", "candy-100"] },
  { bagSize: "31×25", label: "31×25", piecesPerBag: 50, weightLb: 1.96, matches: ["03-100", "yogurt-small-100"] },
].map((rule) => ({
  ...rule,
  sackWeightLb: SALA_SACK_WEIGHT_LB,
  packsPerSack: Math.floor(SALA_SACK_WEIGHT_LB / rule.weightLb),
  piecesPerSack: Math.floor(SALA_SACK_WEIGHT_LB / rule.weightLb) * rule.piecesPerBag,
}));

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function is03(type) { return /^0?\.3 /.test(type) || /^\.3 /.test(type); }
function is09(type) { return /^0?\.9 /.test(type) || /^\.9 /.test(type); }
function is06(type) { return /^0?\.6 /.test(type) || /^\.6 /.test(type); }
function isLiter(type) { return type.startsWith("1 လီတာ"); }
function isCow(type) { return type === "နွားသေး" || type === "နွားကြီး"; }
function is30(type) { return type.startsWith("30 ကျပ်သား"); }
function is08(type) { return type.startsWith("8 ဒေါင့်") || type.startsWith("8ဒေါင့်"); }
function is025(type) { return type === "0.25" || type.startsWith("0.25 ") || type === ".25" || type.startsWith(".25 "); }
function is25(type) { return type.startsWith("25 ကျပ်သား") || type.startsWith("25ကျပ်သား"); }
function isCandy(type) { return type.includes("ချိုချဉ်"); }
function isYogurtSmall(type) { return type === "ဒိန်သေး" || type.startsWith("ဒိန်သေး ") || type === "ဒိန်ဝိုင်းသေး"; }

export function packagingRuleFor(row) {
  const type = clean(row?.bottleType || row?.label);
  const capacity = Number(row?.outputCapacity || row?.capacity || 0);

  if (is03(type) && capacity === 400) return BAG_RULES[0];
  if (isLiter(type) && capacity === 160) return BAG_RULES[0];
  if (is09(type) && capacity === 170) return BAG_RULES[0];
  if (is06(type) && capacity === 250) return BAG_RULES[0];
  if (isCow(type) && capacity === 250) return BAG_RULES[0];
  if (is30(type) && capacity === 320) return BAG_RULES[0];

  if (type === "1 လီတာ ဖြူ" && capacity === 100) return BAG_RULES[1];
  if (type.startsWith("1 လီတာ ပြာ") && capacity === 100) return BAG_RULES[1];
  if (type === "1 လီတာ အဝိုင်း" && capacity === 100) return BAG_RULES[1];
  if (type === "အင်ဂျင်ဝိုင်" && capacity === 100) return BAG_RULES[1];

  if (is09(type) && capacity === 100) return BAG_RULES[2];
  if (type === "8 ဒေါင့် ဖြူ" && capacity === 250) return BAG_RULES[2];
  if (type === "0.3 ဖြူ" && capacity === 200) return BAG_RULES[2];

  if ((type === "0.85" || type === "0.85 ပြာ (S+S)" || type === ".85") && capacity === 100) return BAG_RULES[3];
  if (type === "ရွှေဝိုင်း" && capacity === 200) return BAG_RULES[3];
  if (is025(type) && capacity === 200) return BAG_RULES[3];
  if (is25(type) && capacity === 210) return BAG_RULES[3];

  if ((type === "နွားသေး" || type === "နွားကြီး") && capacity === 100) return BAG_RULES[4];
  if (is06(type) && capacity === 100) return BAG_RULES[4];
  if ((type === "0.6 ဝိုင်း" || type === ".6 ဝိုင်း") && capacity === 100) return BAG_RULES[4];

  if (is08(type) && capacity === 100) return BAG_RULES[5];
  if (is30(type) && capacity === 100) return BAG_RULES[5];
  if (is025(type) && capacity === 100) return BAG_RULES[5];
  if (isCandy(type) && capacity === 100) return BAG_RULES[5];

  if (is03(type) && capacity === 100) return BAG_RULES[6];
  if (isYogurtSmall(type) && capacity === 100) return BAG_RULES[6];
  return null;
}

export function packagingRuleForSize(bagSize) {
  return BAG_RULES.find((rule) => rule.bagSize === String(bagSize || "").trim()) || null;
}

export function packagingPiecesFromSacks(bagSize, sacks) {
  const rule = packagingRuleForSize(bagSize);
  const quantity = Number(sacks || 0);
  if (!rule || !Number.isFinite(quantity) || quantity <= 0) return { sacks: 0, packs: 0, pieces: 0, weightLb: 0 };
  const packs = Math.floor(quantity * rule.packsPerSack);
  return { sacks: quantity, packs, pieces: packs * rule.piecesPerBag, weightLb: packs * rule.weightLb };
}

export function packagingSacksFromPieces(bagSize, pieces) {
  const rule = packagingRuleForSize(bagSize);
  const quantity = Number(pieces || 0);
  if (!rule || !Number.isFinite(quantity) || quantity <= 0) return { sacks: 0, remainderPieces: Math.max(0, quantity) };
  const fullSacks = Math.floor(quantity / rule.piecesPerSack);
  return { sacks: fullSacks, remainderPieces: quantity - fullSacks * rule.piecesPerSack };
}

export function calculatePackagingBags(rows) {
  const grouped = new Map(BAG_RULES.map((rule) => [rule.bagSize, { ...rule, cards: 0, pieces: 0, items: [] }]));
  const unassigned = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.category === "tube") continue;
    const quantity = Number(row?.outputQuantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const rule = packagingRuleFor(row);
    const item = { label: clean(row.bottleType) || "ဗူးအမျိုးအစား မသတ်မှတ်ရသေးပါ", capacity: Number(row.outputCapacity || 0), quantity, unit: row.outputUnit || "ကဒ်" };
    if (!rule) { unassigned.push(item); continue; }
    const group = grouped.get(rule.bagSize);
    group.cards += quantity;
    group.pieces += quantity * item.capacity;
    const key = `${item.label}|${item.capacity}`;
    const existing = group.items.find((entry) => entry.key === key);
    if (existing) existing.quantity += quantity;
    else group.items.push({ ...item, key });
  }
  const groups = [...grouped.values()].filter((group) => group.cards > 0).map((group) => ({
    ...group,
    packagingPieces: group.cards * group.piecesPerBag,
    packagingWeightLb: group.cards * group.weightLb,
  }));
  return {
    groups,
    unassigned,
    totalBags: groups.reduce((sum, group) => sum + group.cards, 0),
    totalPackagingPieces: groups.reduce((sum, group) => sum + group.packagingPieces, 0),
    totalPackagingWeightLb: groups.reduce((sum, group) => sum + group.packagingWeightLb, 0),
    totalPieces: groups.reduce((sum, group) => sum + group.pieces, 0),
  };
}

export { BAG_RULES };
