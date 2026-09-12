import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pinLoginSource = fs.readFileSync(path.join(root, "src/components/PINLogin.jsx"), "utf8");
const actorSessionSource = fs.readFileSync(path.join(root, "src/app/api/auth/actor-session/route.js"), "utf8");
const layoutSource = fs.readFileSync(path.join(root, "src/app/layout-client.jsx"), "utf8");
const productionSource = fs.readFileSync(path.join(root, "src/components/ProductionEntryPage.jsx"), "utf8");
const middlewareSource = fs.readFileSync(path.join(root, "src/middleware.js"), "utf8");
const globalStylesSource = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const dashboardSource = fs.readFileSync(path.join(root, "src/components/Dashboard.jsx"), "utf8");
const sharedHeaderRouteSources = [
  "src/app/activity/page.js",
  "src/app/auto-report-status/page.js",
  "src/app/balance-detail/page.js",
  "src/app/daily-summary/page.js",
  "src/app/data-management/page.js",
  "src/app/orders/page.js",
  "src/app/vercel-build-logs/page.js",
  "src/components/CustomerManagementPage.jsx",
].map((file) => ({ file, source: fs.readFileSync(path.join(root, file), "utf8") }));


describe("Actor access workflow", () => {
  it("starts with actor selection and asks PIN only for non-Zway Zway users", () => {
    expect(pinLoginSource).toContain("setSelectingActor(true);");
    expect(pinLoginSource).toContain('const PRODUCTION_ONLY_ACTORS = ["ဇွဲဇွဲ", "ဖြိုးကို"];');
    expect(pinLoginSource).toContain('PRODUCTION_ONLY_ACTORS.includes(actorName)');
    expect(pinLoginSource).toContain('fetchAuthJson("/api/auth/actor-session"');
    expect(pinLoginSource).toContain("setPendingActor(actorName);");
    expect(pinLoginSource).toContain("body: JSON.stringify({ actorName })");
  });

  it("refreshes session access when switching from production users to သက်မွန်နှင်း", () => {
    expect(pinLoginSource).toContain("CAP_STOCK_ONLY_ACTORS.includes(actorName)");
    expect(pinLoginSource).toContain('await fetchAuthJson("/api/auth/actor-session"');
    expect(actorSessionSource).toContain('const CAP_STOCK_ONLY_ACTORS = ["သက်မွန်နှင်း"];');
    expect(actorSessionSource).toContain('const access = PRODUCTION_ONLY_ACTORS.includes(actorName) ? "production-only" : "standard";');
  });

  it("remembers PIN-authorized users for the browser session and exposes the user switcher", () => {
    expect(pinLoginSource).toContain("AUTHORIZED_ACTORS_KEY");
    expect(pinLoginSource).toContain("rememberAuthorizedActor(pendingActor)");
    expect(pinLoginSource).toContain("new-life-ledger:open-actor-selector");
    expect(pinLoginSource).toContain("actorSelectionLoading");
    expect(pinLoginSource).toContain("ACTOR_SESSION_TIMEOUT_MS");
    expect(pinLoginSource).toContain("long-lived session itself has reached its safety limit");
    expect(pinLoginSource).toContain("အခြား User ပြန်ရွေးရန်");
    expect(pinLoginSource).toContain("Every manual switch must re-confirm the selected user with the PIN");
    expect(pinLoginSource).toContain("အသုံးပြုသူကို ပြန်ရွေးပြီး PIN code ထည့်ပါ");
    expect(pinLoginSource).toContain('const currentActor = localStorage.getItem("actorName");');
    expect(pinLoginSource).toContain("if (isAuthenticated && actorName === currentActor)");
    expect(layoutSource).toContain("ActorSwitcher actorName={actorName}");
    expect(layoutSource).toContain("လက်ရှိ User");
    expect(layoutSource).toContain("actor-switcher pointer-events-none fixed z-[115]");
    expect(globalStylesSource).toContain(".actor-switcher");
    expect(globalStylesSource).toContain(".dashboard-root-page");
    expect(globalStylesSource).toContain("--top-control-rail-height: 5.5rem;");
    expect(globalStylesSource).toContain(".shared-page-header-route");
  });

  it("keeps every route page on the shared header without duplicate Dashboard/title markup", () => {
    expect(layoutSource).toContain("shared-page-header");
    expect(layoutSource).toContain("New Life Ledger Dashboard");
    expect(layoutSource).toContain("shared-page-header-nav");
    expect(layoutSource).not.toContain("absolute left-0 top-0 text-base font-semibold text-cyan-700");
    expect(globalStylesSource).toContain("margin-top: 4.5rem");
    expect(globalStylesSource).toContain(".dashboard-root-page {\n  padding-top: 4rem;");
    expect(globalStylesSource).toContain("padding-top: var(--top-control-rail-layout-height);");
    expect(globalStylesSource).toContain("--top-control-rail-height: 11rem;");
    expect(globalStylesSource).toContain("--top-control-rail-height: 8rem;");
    expect(globalStylesSource).toContain(".shared-page-header-route + .app-page-main");
    expect(globalStylesSource).toContain("padding-top: 1.25rem;");
    expect(globalStylesSource).toContain("padding-top: 1.5rem;");
    expect(globalStylesSource).toContain(".shared-page-header-route");
    expect(globalStylesSource).toContain("margin-top: 9rem !important;");
    sharedHeaderRouteSources.forEach(({ file, source }) => {
      expect(source, file).not.toContain('Link href="/"');
      expect(source, file).not.toContain("← Dashboard");
      expect(source, file).not.toMatch(/<h1[\s>]/);
      expect(source, file).toContain("app-page-main");
    });
    expect(fs.readFileSync(path.join(root, "src/components/ProductionEntryPage.jsx"), "utf8")).toContain("app-page-container app-page-surface production-container");
    expect(fs.readFileSync(path.join(root, "src/app/activity/page.js"), "utf8")).toContain("app-page-container app-page-surface");
    expect(globalStylesSource).toContain("margin: 0.25rem auto 0;");
  });

  it("keeps ဆောင်းဦး on Ledger and ဇွဲဇွဲ on Production", () => {
    expect(layoutSource).toContain("isLedgerOnlyActor");
    expect(layoutSource).toContain("router.replace('/')");
    expect(layoutSource).toContain("pathname === '/'");
    expect(layoutSource).toContain("pathname === '/balance-detail'");
    expect(layoutSource).toContain("normalizedActorName !== 'ဆောင်းဦး' || pathname === '/balance-detail'");
    expect(middlewareSource).toContain('LEDGER_ONLY_ACTOR');
    expect(middlewareSource).toContain('LEDGER_BLOCKED_API_PATHS');
    expect(middlewareSource).toContain('path !== "/"');
    expect(middlewareSource).toContain('path !== "/balance-detail"');
    expect(dashboardSource).toContain('const isSangEulDashboard = dashboardActorName === "ဆောင်းဦး"');
    expect(dashboardSource).toContain('CUSTOMER နှင့် အကြွေးအခြေအနေ');
  });

  it("keeps Zway Zway on Production while keeping Dashboard navigation for other users", () => {
    expect(layoutSource).toContain("isProductionOnlyActor");
    expect(layoutSource).toContain("actorName === 'ဇွဲဇွဲ' || actorName === 'ဖြိုးကို'");
    expect(layoutSource).toContain("router.replace('/production')");
    expect(layoutSource).toContain("pathname === '/production'");
    expect(layoutSource).toContain("const normalizedActorName = String(actorName || '').trim();");
    expect(layoutSource).toContain("const showDashboardLink = normalizedActorName !== 'ဇွဲဇွဲ' && (normalizedActorName !== 'ဆောင်းဦး' || pathname === '/balance-detail');");
    expect(layoutSource).toContain('<Link href="/"');
    expect(productionSource).not.toContain('ထွက်ရှိမှု မှတ်တမ်းတင်ရန်</h1>');
    expect(middlewareSource).toContain('PRODUCTION_API_PATHS');
    expect(middlewareSource).toContain('"ဖြိုးကို"');
    expect(middlewareSource).toContain('path !== "/production"');
    expect(layoutSource).toContain("SharedPageHeader pathname={pathname} actorName={actorName}");
    expect(dashboardSource).toContain('{isLedgerView ? (');
    expect(dashboardSource).toContain('setDashboardActorName(initialActorName.trim())');
    expect(layoutSource).toContain("formatMyanmarClock(currentTime)");
    expect(layoutSource).toContain("text-2xl font-bold tracking-wider");
    expect(layoutSource).not.toContain("sm:text-5xl");
    expect(layoutSource).toContain("min-h-[170px] flex-col justify-between");
    expect(layoutSource).toContain("min-h-[136px] flex-1 flex-col justify-between");
    expect(layoutSource).toContain('<div className="min-h-10" aria-hidden="true" />');
    expect(layoutSource).toContain("'--app-zoom': appZoom");
    expect(globalStylesSource).toContain("--top-control-rail-layout-height: calc(var(--top-control-rail-height) / var(--app-zoom, 1));");
    expect(globalStylesSource).toContain("margin-top: calc(var(--top-control-rail-layout-height) + 0.75rem);");
    expect(globalStylesSource).toContain(".shared-page-header-route {");
    expect(globalStylesSource).toContain("margin-top: 9rem !important;");
  });
});
