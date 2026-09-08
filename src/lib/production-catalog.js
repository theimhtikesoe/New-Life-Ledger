export const PRODUCTION_CATEGORIES = [
  { value: "bottle", label: "ဗူးခွံ" },
  { value: "tube", label: "Tube" },
];

export const BOTTLE_ITEMS = [
  { type: "0.3 ဖြူ", capacities: [100, 200, 400] },
  { type: "0.3 ပြာ (S+1)", capacities: [100, 200, 400] },
  { type: "0.3 ပြာ (S+S)", capacities: [100, 200, 400] },
  { type: "လေးထောင့် 13g", capacities: [100, 200] },
  { type: "8 ဒေါင့် ဖြူ", capacities: [100, 250] },
  { type: "8 ဒေါင့် (S+1)", capacities: [100, 250] },
  { type: "8 ဒေါင့် (S+S)", capacities: [100, 250, 500] },
  { type: "ဒိန်သေး", capacities: [100, 250] },
  { type: "ဒိန်သေး (S+1)", capacities: [100, 250] },
  { type: "ဒိန်သေး (S+S)", capacities: [250] },
  { type: "ဒိန်ကြီး", capacities: [100, 200] },
  { type: "ဒိန်ကြီး (S+1)", capacities: [100, 200] },
  { type: "ဒိန်ကြီး (S+S)", capacities: [200] },
  { type: "ဒိန်ဝိုင်းအလတ်", capacities: [100, 200] },
  { type: "ရွှေဝိုင်း", capacities: [100, 200] },
  { type: "0.25", capacities: [100, 200] },
  { type: "0.25 ပြာ", capacities: [100, 200] },
  { type: "ချိုချဉ်အသေး", capacities: [100] },
  { type: "ချိုချဉ်အကြီး (အချိုရည်ဗူးကြီး)", capacities: [100] },
  { type: "အင်ဂျင်ဝိုင်", capacities: [100] },
  { type: "လုံးချော (16g)", capacities: [100] },
  { type: "0.5 ဖြူ", capacities: [100, 270] },
  { type: "0.6 ဖြူ", capacities: [100, 250] },
  { type: "0.6 ပြာ", capacities: [100, 250] },
  { type: "25 ကျပ်သား", capacities: [100, 210] },
  { type: "30 ကျပ်သား", capacities: [100, 320] },
  { type: "နွားသေး", capacities: [100, 250] },
  { type: "နွားကြီး", capacities: [100, 250] },
  { type: "0.85", capacities: [100] },
  { type: "0.9 ဖြူ", capacities: [100, 170] },
  { type: "0.9 ပြာ", capacities: [100, 170] },
  { type: "1 လီတာ ဖြူ", capacities: [100, 160] },
  { type: "1 လီတာ ပြာ", capacities: [100, 160] },
  { type: "1 လီတာ အဝိုင်း", capacities: [100] },
  { type: "45 ကျပ်သား", capacities: [200] },
];

export const BOTTLE_GROUPS = [
  { key: "03-white", label: ".3 ဖြူ", description: "0.3 ဖြူ" },
  { key: "03-blue", label: ".3 ပြာ", description: "0.3 ပြာ" },
  { key: "square-golden", label: "လေးထောင့် / ရွှေဝိုင်း", description: "လေးထောင့် 13g နှင့် ရွှေဝိုင်း" },
  { key: "08-corner", label: "8 ဒေါင့်", description: "8 ဒေါင့် ဖြူ၊ S+1 နှင့် S+S" },
  { key: "yogurt", label: "ဒိန်ချဉ်", description: "ဒိန်သေးနှင့် ဒိန်ကြီး" },
  { key: "025", label: ".25 / .25 ပြာ", description: "0.25 နှင့် 0.25 ပြာ" },
  { key: "small-candy", label: "ချိုချဉ်အသေး", description: "ချိုချဉ်အသေး သီးသန့်စျေး" },
  { key: "round-16g", label: "လုံးချော 16g", description: "လုံးချော 16g သီးသန့်စျေး" },
  { key: "sweet-drink-large", label: "ချိုချဉ်အကြီး (အချိုရည်ဗူး)", description: "ချိုချဉ်အကြီး 100 ဆံ့" },
  { key: "engine-oil", label: "အင်ဂျင်ဝိုင်", description: "အင်ဂျင်ဝိုင် 100 ဆံ့" },
  { key: "05", label: ".5", description: "0.5 ဖြူ" },
  { key: "06", label: ".6", description: "0.6 ဖြူ / ပြာ" },
  { key: "25", label: "25 ကျပ်သား", description: "25 ကျပ်သား" },
  { key: "30", label: "30 ကျပ်သား", description: "30 ကျပ်သား" },
  { key: "45", label: "45 ကျပ်သား", description: "45 ကျပ်သား" },
  { key: "cow", label: "နွား", description: "နွားသေး / နွားကြီး" },
  { key: "085", label: ".85", description: "0.85" },
  { key: "09", label: ".9", description: "0.9 ဖြူ / ပြာ" },
  { key: "liter", label: "1 လီတာ", description: "1 လီတာ ဖြူ / ပြာ" },
];

export function getBottleGroup(type) {
  const value = String(type || "");
  if (value.startsWith("8 ဒေါင့်")) return "08-corner";
  if (value.startsWith("လေးထောင့်") || value === "ရွှေဝိုင်း") return "square-golden";
  if (value === "0.3 ဖြူ") return "03-white";
  if (value.includes("0.3 ပြာ")) return "03-blue";
  if (["ဒိန်သေး", "ဒိန်သေး (S+1)", "ဒိန်သေး (S+S)", "ဒိန်ကြီး", "ဒိန်ကြီး (S+1)", "ဒိန်ကြီး (S+S)", "ဒိန်ဝိုင်းအလတ်"].includes(value)) return "yogurt";
  if (value.startsWith("0.25")) return "025";
  if (value === "ချိုချဉ်အကြီး (အချိုရည်ဗူးကြီး)") return "sweet-drink-large";
  if (value === "အင်ဂျင်ဝိုင်") return "engine-oil";
  if (value === "ချိုချဉ်အသေး") return "small-candy";
  if (value === "လုံးချော (16g)") return "round-16g";
  if (value.startsWith("0.5")) return "05";
  if (value.startsWith("0.6")) return "06";
  if (value.startsWith("25 ")) return "25";
  if (value.startsWith("30 ")) return "30";
  if (value.startsWith("45 ")) return "45";
  if (value.startsWith("နွား")) return "cow";
  if (value === "0.85") return "085";
  if (value.startsWith("0.9")) return "09";
  if (value.startsWith("1 လီတာ")) return "liter";
  return "candy";
}

export function getBottleUnit(type) {
  const value = String(type || "");
  return value.startsWith("8 ဒေါင့်") || value.startsWith("ဒိန်") ? "ထုပ်" : "ကဒ်";
}

export function getBottleDisplayName(type) {
  return String(type || "") === "သေးရှည်" ? "ဒိန်ဝိုင်းအလတ်" : String(type || "");
}

export const TUBE_BY_MACHINE = {
  TB1: [
    { g: "24g", color: "W", pcsPerBag: 1500, label: "24g W (အဖြူ)" },
    { g: "24g", color: "B (S+1)", pcsPerBag: 1500, label: "24g B (S+1)" },
    { g: "16g", color: "W", pcsPerBag: 2000, label: "16g W (အဖြူ)" },
    { g: "16g", color: "S+1", pcsPerBag: 2000, label: "16g (S+1)" },
  ],
  TB2: [
    { g: "13g", color: "W", pcsPerBag: 2500, label: "13g W (အဖြူ)" },
    { g: "13g", color: "S+1", pcsPerBag: 2500, label: "13g (S+1)" },
    { g: "13g", color: "S+S", pcsPerBag: 2500, label: "13g (S+S)" },
  ],
};

export const MACHINES = [
  { code: "BT1", name: "ဗူးစက်-၁", category: "bottle" },
  { code: "BT2", name: "ဗူးစက်-၂", category: "bottle" },
  { code: "BT3", name: "ဗူးစက်-၃", category: "bottle" },
  { code: "BT4", name: "ဗူးစက်-၄", category: "bottle" },
  { code: "BT5", name: "ဗူးစက်-၅", category: "bottle" },
  { code: "BT6", name: "ဗူးစက်-၆", category: "bottle" },
  { code: "TB1", name: "Tube စက် ၁", category: "tube" },
  { code: "TB2", name: "Tube စက် ၂", category: "tube" },
];

export function getTubeItemsForMachine(code) {
  const key = String(code || "").toUpperCase().replace(/\s+/g, "");
  for (const machineCode of Object.keys(TUBE_BY_MACHINE)) {
    if (key.includes(machineCode)) return TUBE_BY_MACHINE[machineCode];
  }
  return Object.values(TUBE_BY_MACHINE).flat();
}

export function getMachine(code) {
  return MACHINES.find((machine) => machine.code === code) || null;
}
