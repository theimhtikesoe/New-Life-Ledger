export const ACTORS = ["ဖေဖေ/မေမေ", "ပုံ့ပုံ့", "ဆောင်းဦး", "ဇွဲဇွဲ", "ဖြိုးကို", "Rhyzoe", "သက်မွန်နှင်း"];
export const MANAGER_ACTORS = ["ဖေဖေ/မေမေ"];
export const PERMISSION_PAGES = [
  { path: "/", label: "Dashboard" },
  { path: "/ledger", label: "ငွေရှင်းတမ်း / Customer Ledger" },
  { path: "/production", label: "ထုတ်လုပ်မှု" },
  { path: "/production-history", label: "ထုတ်လုပ်မှုမှတ်တမ်း" },
  { path: "/tube-production-history", label: "Tube ထုတ်လုပ်မှုမှတ်တမ်း" },
  { path: "/balance-detail", label: "လက်ကျန်ငွေ အသေးစိတ်" },
  { path: "/daily-bottle-sales", label: "နေ့စဉ်ဗူးရောင်းစာရင်း" },
  { path: "/daily-summary", label: "နေ့စဉ်စာရင်းချုပ်" },
  { path: "/tube-stock", label: "စက်ရုံ Tube လက်ကျန်" },
  { path: "/factory-stock", label: "စက်ရုံဗူးလက်ကျန်" },
  { path: "/cap-stock", label: "စက်ရုံအဖုံးလက်ကျန်" },
  { path: "/customer-management", label: "Customer Management" },
  { path: "/user-management", label: "User Management" },
  { path: "/orders", label: "Customer Orders" },
  { path: "/activity", label: "Activity History" },
  { path: "/trace", label: "Trace / Tracking" },
  { path: "/discounts", label: "Customer လျှော့စျေး" },
  { path: "/price-settings", label: "စျေးနှုန်းသတ်မှတ်ရန်" },
  { path: "/data-management", label: "Data Management" },
  { path: "/auto-report-status", label: "Auto Report အခြေအနေ" },
  { path: "/vercel-build-logs", label: "Vercel Build Logs" },
];

export function defaultAllowedPaths(actorName) {
  if (actorName === "ဇွဲဇွဲ" || actorName === "ဖြိုးကို") return ["/production"];
  if (actorName === "ဆောင်းဦး") return ["/", "/ledger", "/balance-detail"];
  if (actorName === "သက်မွန်နှင်း") return ["/cap-stock"];
  return PERMISSION_PAGES.map((page) => page.path);
}

export function normalizeAllowedPaths(value, actorName) {
  const allowed = Array.isArray(value) ? value.filter((path) => PERMISSION_PAGES.some((page) => page.path === path)) : defaultAllowedPaths(actorName);
  return [...new Set(allowed)];
}
