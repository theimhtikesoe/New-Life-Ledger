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
  { type: "8 ဒေါင့် (S+S)", capacities: [100, 250] },
  { type: "ဒိန်သေး", capacities: [100, 250] },
  { type: "ဒိန်သေး (S+1)", capacities: [100, 250] },
  { type: "ဒိန်ကြီး", capacities: [100, 200] },
  { type: "ဒိန်ကြီး (S+1)", capacities: [100, 200] },
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
];

export const BOTTLE_GROUPS = [
  { key: "03-white", label: ".3 ဖြူ", description: "0.3 ဖြူ နှင့် 8 ဒေါင့် ဖြူ" },
  { key: "03-blue", label: ".3 ပြာ", description: "0.3 ပြာ နှင့် 8 ဒေါင့် S+1 / S+S" },
  { key: "special", label: "ရှယ်ရှယ်", description: "ဒိန်သေး၊ ဒိန်ကြီး၊ ရွှေဝိုင်း" },
  { key: "025", label: ".25", description: "0.25 အမျိုးအစား" },
  { key: "candy", label: "ချိုချဉ် / လုံးချော", description: "အခြားအရွယ်အစား" },
  { key: "05", label: ".5", description: "0.5 ဖြူ" },
  { key: "06", label: ".6", description: "0.6 ဖြူ / ပြာ" },
  { key: "25", label: "25 ကျပ်သား", description: "25 ကျပ်သား" },
  { key: "30", label: "30 ကျပ်သား", description: "30 ကျပ်သား" },
  { key: "cow", label: "နွား", description: "နွားသေး / နွားကြီး" },
  { key: "085", label: ".85", description: "0.85" },
  { key: "09", label: ".9", description: "0.9 ဖြူ / ပြာ" },
  { key: "liter", label: "1 လီတာ", description: "1 လီတာ ဖြူ / ပြာ" },
];

export function getBottleGroup(type) {
  const value = String(type || "");
  if (value === "0.3 ဖြူ" || value === "8 ဒေါင့် ဖြူ") return "03-white";
  if (value.includes("0.3 ပြာ") || value === "8 ဒေါင့် (S+1)" || value === "8 ဒေါင့် (S+S)") return "03-blue";
  if (["ဒိန်သေး", "ဒိန်သေး (S+1)", "ဒိန်ကြီး", "ဒိန်ကြီး (S+1)", "ရွှေဝိုင်း"].includes(value)) return "special";
  if (value.startsWith("0.25")) return "025";
  if (["ချိုချဉ်", "လုံးချော (16g)"].includes(value)) return "candy";
  if (value.startsWith("0.5")) return "05";
  if (value.startsWith("0.6")) return "06";
  if (value.startsWith("25 ")) return "25";
  if (value.startsWith("30 ")) return "30";
  if (value.startsWith("နွား")) return "cow";
  if (value === "0.85") return "085";
  if (value.startsWith("0.9")) return "09";
  if (value.startsWith("1 လီတာ")) return "liter";
  return "candy";
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
  { code: "BT1", name: "ဗူးခွံ ၁", category: "bottle" },
  { code: "BT2", name: "ဗူးခွံ ၂", category: "bottle" },
  { code: "BT3", name: "ဗူးခွံ ၃", category: "bottle" },
  { code: "BT4", name: "ဗူးခွံ ၄", category: "bottle" },
  { code: "BT5", name: "ဗူးခွံ ၅", category: "bottle" },
  { code: "BT6", name: "ဗူးခွံ ၆", category: "bottle" },
  { code: "CT", name: "Cooling Tower", category: "bottle" },
  { code: "TB1", name: "Tube စက် ၁", category: "tube" },
  { code: "TB2", name: "Tube စက် ၂", category: "tube" },
  { code: "WC1", name: "Water Cooler 1", category: "bottle" },
  { code: "WC2", name: "Water Cooler 2", category: "bottle" },
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
