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
