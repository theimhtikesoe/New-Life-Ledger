import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pinLoginSource = fs.readFileSync(path.join(root, "src/components/PINLogin.jsx"), "utf8");
const layoutSource = fs.readFileSync(path.join(root, "src/app/layout-client.jsx"), "utf8");
const productionSource = fs.readFileSync(path.join(root, "src/components/ProductionEntryPage.jsx"), "utf8");
const middlewareSource = fs.readFileSync(path.join(root, "src/middleware.js"), "utf8");
const globalStylesSource = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
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
    expect(pinLoginSource).toContain('if (actorName === "ဇွဲဇွဲ")');
    expect(pinLoginSource).toContain('fetchAuthJson("/api/auth/actor-session"');
    expect(pinLoginSource).toContain("setPendingActor(actorName);");
    expect(pinLoginSource).toContain("body: JSON.stringify({ actorName })");
  });

  it("remembers PIN-authorized users for the browser session and exposes the user switcher", () => {
    expect(pinLoginSource).toContain("AUTHORIZED_ACTORS_KEY");
    expect(pinLoginSource).toContain("rememberAuthorizedActor(pendingActor)");
    expect(pinLoginSource).toContain("new-life-ledger:open-actor-selector");
    expect(pinLoginSource).toContain("actorSelectionLoading");
    expect(pinLoginSource).toContain("ACTOR_IDLE_TIMEOUT_MS");
    expect(pinLoginSource).toContain("After five idle minutes");
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
    expect(globalStylesSource).toContain("padding-top: var(--top-control-rail-height);");
    expect(globalStylesSource).toContain("--top-control-rail-height: 11rem;");
    expect(globalStylesSource).toContain("--top-control-rail-height: 8rem;");
    expect(globalStylesSource).toContain("margin-bottom: 1.75rem");
    expect(globalStylesSource).toContain(".app-page-main {\n  padding-top: 1.25rem;");
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

  it("keeps Zway Zway on Production while keeping Dashboard navigation for other users", () => {
    expect(layoutSource).toContain("isProductionOnlyActor");
    expect(layoutSource).toContain("router.replace('/production')");
    expect(layoutSource).toContain("pathname === '/production'");
    expect(layoutSource).toContain("actorName !== 'ဇွဲဇွဲ'");
    expect(layoutSource).toContain('<Link href="/"');
    expect(productionSource).not.toContain('ထွက်ရှိမှု မှတ်တမ်းတင်ရန်</h1>');
    expect(middlewareSource).toContain('PRODUCTION_API_PATHS');
    expect(middlewareSource).toContain('path !== "/production"');
    expect(layoutSource).toContain("SharedPageHeader pathname={pathname} actorName={actorName}");
    expect(layoutSource).toContain("formatMyanmarClock(currentTime)");
    expect(layoutSource).toContain("text-xl font-bold tracking-wider");
    expect(layoutSource).not.toContain("sm:text-5xl");
  });
});
