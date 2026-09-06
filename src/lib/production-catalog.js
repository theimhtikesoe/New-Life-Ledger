export const PRODUCTION_CATEGORIES = [
  { value: "bottle", label: "ဗူးခွံ" },
  { value: "tube", label: "Tube" },
];

export const BOTTLE_ITEMS = [
  { type: "0.3 ဖြူ", capacities: [100, 200, 400] },
  { type: "0.3 ပြာ (S+1)", capacities: [100, 200, 400] },
  { type: "0.3 ပြာ (S+S)", capacities: [100, 200, 400] },
  { type: "8 ဒေါင့် ဖြူ", capacities: [100, 250] },
  { type: "8 ဒေါင့် (S+1)", capacities: [100, 250] },
  { type: "8 ဒေါင့် (S+S)", capacities: [100, 250, 500] },
  { type: "ဒိန်သေး", capacities: [100, 250] },
  { type: "ဒိန်သေး (S+1)", capacities: [100, 250] },
  { type: "ဒိန်သေး (S+S)", capacities: [250] },
  { type: "ဒိန်ကြီး", capacities: [100, 200] },
  { type: "ဒိန်ကြီး (S+1)", capacities: [100, 200] },
  { type: "ဒိန်ကြီး (S+S)", capacities: [200] },
  { type: "ရွှေဝိုင်း", capacities: [100, 200] },
  { type: "0.25", capacities: [100, 200] },
  { type: "0.25 ပြာ", capacities: [100, 200] },
  { type: "ချိုချဉ်", capacities: [100] },
  { type: "လုံးချော (16g)", capacities: [100] },
  { type: "0.5 ဖြူ", capacities: [100, 270] },
  { type: "0.6 ဖြူ", capacities: [100, 250] },
  { type: "0.6 ပြာ", capacities: [100, 250] },
  { type: "25 ကျပ်သား", capacities: [100] },
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
  { key: "08-corner", label: "8 ဒေါင့်", description: "8 ဒေါင့် ဖြူ၊ S+1 နှင့် S+S" },
  { key: "special", label: "ဒိန်ချဉ်/ရွှေဝိုင်း", description: "ဒိန်သေး၊ ဒိန်ကြီး၊ ရွှေဝိုင်း" },
  { key: "025", label: ".25", description: "0.25 အမျိုးအစား" },
  { key: "candy", label: "ချိုချဉ် / လုံးချော", description: "အခြားအရွယ်အစား" },
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
  if (value === "0.3 ဖြူ") return "03-white";
  if (value.includes("0.3 ပြာ")) return "03-blue";
  if (["ဒိန်သေး", "ဒိန်သေး (S+1)", "ဒိန်သေး (S+S)", "ဒိန်ကြီး", "ဒိန်ကြီး (S+1)", "ဒိန်ကြီး (S+S)", "ရွှေဝိုင်း"].includes(value)) return "special";
  if (value.startsWith("0.25")) return "025";
  if (["ချိုချဉ်", "လုံးချော (16g)"].includes(value)) return "candy";
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
