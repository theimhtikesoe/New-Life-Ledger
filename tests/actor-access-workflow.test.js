import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pinLoginSource = fs.readFileSync(path.join(root, "src/components/PINLogin.jsx"), "utf8");
const layoutSource = fs.readFileSync(path.join(root, "src/app/layout-client.jsx"), "utf8");
const productionSource = fs.readFileSync(path.join(root, "src/components/ProductionEntryPage.jsx"), "utf8");
const middlewareSource = fs.readFileSync(path.join(root, "src/middleware.js"), "utf8");


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
    expect(layoutSource).toContain("ActorSwitcher actorName={actorName}");
    expect(layoutSource).toContain("လက်ရှိ User");
  });

  it("keeps Zway Zway on Production and removes the dashboard escape link", () => {
    expect(layoutSource).toContain("isProductionOnlyActor");
    expect(layoutSource).toContain("router.replace('/production')");
    expect(layoutSource).toContain("pathname === '/production'");
    expect(productionSource).toContain('{actorName !== "ဇွဲဇွဲ" ? <Link href="/"');
    expect(middlewareSource).toContain('PRODUCTION_API_PATHS');
    expect(middlewareSource).toContain('path !== "/production"');
    expect(layoutSource).toContain("SharedPageHeader pathname={pathname} actorName={actorName}");
    expect(layoutSource).toContain("formatMyanmarClock(currentTime)");
  });
});
