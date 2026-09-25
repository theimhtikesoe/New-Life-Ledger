export const ACTORS = ["ဖေဖေ/မေမေ", "ပုံ့ပုံ့", "ဆောင်းဦး", "ဇွဲဇွဲ", "ဖြိုးကို", "Rhyzoe", "သက်မွန်နှင်း"];
export const MANAGER_ACTORS = ["ဖေဖေ/မေမေ"];
export const RECONCILIATION_PAGE_PATH = "/debt-reconciliation";
export const PREPAYMENT_RECONCILIATION_PAGE_PATH = "/prepayment-reconciliation";
export const USER_ROLES = ["Manager", "Accountant", "Production", "Sales", "Viewer"];
export function defaultUserRole(actorName) {
  if (actorName === "ဖေဖေ/မေမေ") return "Manager";
  if (actorName === "ဇွဲဇွဲ" || actorName === "ဖြိုးကို") return "Production";
  if (actorName === "ဆောင်းဦး") return "Accountant";
  return "Sales";
}
export const PERMISSION_PAGES = [
  { path: "/", label: "Dashboard" },
  { path: "/ledger", label: "ငွေရှင်းတမ်း / Customer Ledger" },
  { path: "/production", label: "ထုတ်လုပ်မှု" },
  { path: "/production-history", label: "ထုတ်လုပ်မှုမှတ်တမ်း" },
  { path: "/packaging-bag-report", label: "တစ်နေ့တာ ထုပ်ပိုး အိတ်ခွံ" },
  { path: "/monthly-packaging-bag-report", label: "တစ်လစာ ထုပ်ပိုး အိတ်ခွံ" },
  { path: "/packaging-bag-stock", label: "စက်ရုံ ထုပ်ပိုး အိတ်ခွံ လက်ကျန်" },
  { path: "/tube-production-history", label: "Tube ထုတ်လုပ်မှုမှတ်တမ်း" },
  { path: "/monthly-tube-production", label: "တစ်လစာ Tube ထွက်ရှိမှု" },
  { path: "/balance-detail", label: "လက်ကျန်ငွေ အသေးစိတ်" },
  { path: RECONCILIATION_PAGE_PATH, label: "အကြွေးဟောင်း စာရင်းညှိခြင်း" },
  { path: PREPAYMENT_RECONCILIATION_PAGE_PATH, label: "ငွေကြိုချေ စစ်ဆေးခြင်း" },
  { path: "/daily-bottle-sales", label: "နေ့စဉ်ဗူးရောင်းစာရင်း" },
  { path: "/monthly-bottle-sales", label: "တစ်လစာဗူးရောင်းစာရင်း" },
  { path: "/daily-sales-summary", label: "ယနေ့ လက်လီ / လက်ကား စုစုပေါင်း" },
  { path: "/daily-report-download", label: "နေ့စွဲအလိုက် Daily PDF Download" },
  { path: "/daily-summary", label: "နေ့စဉ်စာရင်းချုပ်" },
  { path: "/tube-stock", label: "စက်ရုံ Tube လက်ကျန်" },
  { path: "/glue-stock", label: "စက်ရုံ ကော်စေ့ လက်ကျန်" },
  { path: "/factory-stock", label: "စက်ရုံဗူးလက်ကျန်" },
  { path: "/cap-stock", label: "စက်ရုံအဖုံးလက်ကျန်" },
  { path: "/customer-management", label: "Customer Management" },
  { path: "/user-management", label: "User Management" },
  { path: "/orders", label: "Customer Orders" },
  { path: "/activity", label: "Activity History" },
  { path: "/trace", label: "Trace / Tracking" },
  { path: "/discounts", label: "Customer လျှော့စျေး" },
  { path: "/expenses", label: "အသုံးစားရိတ်" },
  { path: "/price-settings", label: "စျေးနှုန်းသတ်မှတ်ရန်" },
  { path: "/data-management", label: "Data Management" },
  { path: "/auto-report-status", label: "Auto Report အခြေအနေ" },
  { path: "/vercel-build-logs", label: "Vercel Build Logs" },
];

export function defaultAllowedPaths(actorName) {
  if (actorName === "ဇွဲဇွဲ") return ["/", "/production", "/production-history", "/packaging-bag-report", "/monthly-packaging-bag-report", "/packaging-bag-stock", "/glue-stock", "/factory-stock", RECONCILIATION_PAGE_PATH, PREPAYMENT_RECONCILIATION_PAGE_PATH];
  if (actorName === "ဖြိုးကို") return ["/", "/production", "/tube-production-history", "/tube-stock", "/glue-stock", "/monthly-tube-production", "/monthly-packaging-bag-report", "/packaging-bag-stock", RECONCILIATION_PAGE_PATH, PREPAYMENT_RECONCILIATION_PAGE_PATH];
  if (actorName === "ဆောင်းဦး") return ["/", "/ledger", "/balance-detail", "/monthly-bottle-sales", "/monthly-packaging-bag-report", "/packaging-bag-stock", "/glue-stock", RECONCILIATION_PAGE_PATH, PREPAYMENT_RECONCILIATION_PAGE_PATH];
  if (actorName === "သက်မွန်နှင်း") return ["/", "/cap-stock", "/packaging-bag-report", "/monthly-packaging-bag-report", "/packaging-bag-stock", "/glue-stock", RECONCILIATION_PAGE_PATH, PREPAYMENT_RECONCILIATION_PAGE_PATH];
  return PERMISSION_PAGES.map((page) => page.path);
}

export function normalizeAllowedPaths(value, actorName) {
  const allowed = Array.isArray(value) ? value.filter((path) => PERMISSION_PAGES.some((page) => page.path === path)) : defaultAllowedPaths(actorName);
  if (!allowed.includes("/packaging-bag-stock")) allowed.push("/packaging-bag-stock");
  if (!allowed.includes("/monthly-packaging-bag-report")) allowed.push("/monthly-packaging-bag-report");
  // Keep the bottle-sales reports reachable for the parent/manager account even
  // when its stored permission row predates these pages.
  if (actorName === "ဖေဖေ/မေမေ") {
    if (!allowed.includes("/daily-bottle-sales")) allowed.push("/daily-bottle-sales");
    if (!allowed.includes("/monthly-bottle-sales")) allowed.push("/monthly-bottle-sales");
    if (!allowed.includes("/monthly-tube-production")) allowed.push("/monthly-tube-production");
    if (!allowed.includes("/packaging-bag-report")) allowed.push("/packaging-bag-report");
    if (!allowed.includes("/packaging-bag-stock")) allowed.push("/packaging-bag-stock");
  }
  if (actorName === "ဇွဲဇွဲ" || actorName === "ဖြိုးကို") {
    return [...new Set([...defaultAllowedPaths(actorName), RECONCILIATION_PAGE_PATH, PREPAYMENT_RECONCILIATION_PAGE_PATH])];
  }
  if (actorName === "သက်မွန်နှင်း") {
    return [...new Set([...defaultAllowedPaths(actorName), RECONCILIATION_PAGE_PATH, PREPAYMENT_RECONCILIATION_PAGE_PATH])];
  }
  if (actorName !== "ဇွဲဇွဲ" && actorName !== "ဖြိုးကို" && actorName !== "ဆောင်းဦး" && actorName !== "သက်မွန်နှင်း" && !allowed.includes("/expenses")) allowed.push("/expenses");
  if (actorName !== "ဇွဲဇွဲ" && actorName !== "ဖြိုးကို" && actorName !== "သက်မွန်နှင်း" && allowed.includes("/") && !allowed.includes("/daily-sales-summary")) allowed.push("/daily-sales-summary");
  // Shared accounting control: do not redirect an authenticated actor away
  // from this page just because their legacy permission row predates it.
  if (!allowed.includes(RECONCILIATION_PAGE_PATH)) allowed.push(RECONCILIATION_PAGE_PATH);
  if (!allowed.includes(PREPAYMENT_RECONCILIATION_PAGE_PATH)) allowed.push(PREPAYMENT_RECONCILIATION_PAGE_PATH);
  return [...new Set(allowed)];
}
