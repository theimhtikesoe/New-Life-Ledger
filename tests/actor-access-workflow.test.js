import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pinLoginSource = fs.readFileSync(path.join(root, "src/components/PINLogin.jsx"), "utf8");
const layoutSource = fs.readFileSync(path.join(root, "src/app/layout-client.jsx"), "utf8");
const productionSource = fs.readFileSync(path.join(root, "src/components/ProductionEntryPage.jsx"), "utf8");
const middlewareSource = fs.readFileSync(path.join(root, "src/middleware.js"), "utf8");
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
    expect(pinLoginSource).toContain("five-minute rule only");
    expect(pinLoginSource).toContain("controls automatic idle locking");
    expect(pinLoginSource).toContain("အခြား User ပြန်ရွေးရန်");
    expect(layoutSource).toContain("ActorSwitcher actorName={actorName}");
    expect(layoutSource).toContain("လက်ရှိ User");
  });

  it("keeps every route page on the shared header without duplicate Dashboard/title markup", () => {
    expect(layoutSource).toContain("shared-page-header");
    sharedHeaderRouteSources.forEach(({ file, source }) => {
      expect(source, file).not.toContain('Link href="/"');
      expect(source, file).not.toContain("← Dashboard");
      expect(source, file).not.toMatch(/<h1[\s>]/);
      expect(source, file).toContain("app-page-main");
    });
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
