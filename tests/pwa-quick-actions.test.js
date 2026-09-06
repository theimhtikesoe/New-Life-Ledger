import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layoutSource = fs.readFileSync(path.join(root, "src/app/layout-client.jsx"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const dashboardSource = fs.readFileSync(path.join(root, "src/components/Dashboard.jsx"), "utf8");

describe("PWA quick actions", () => {
  it("keeps the fixed Refresh control and adds accessible app zoom controls", () => {
    expect(layoutSource).toContain("pwa-quick-actions");
    expect(layoutSource).toContain("aria-label=\"Refresh — စာမျက်နှာ data ပြန်လည်ရယူမည်\"");
    expect(layoutSource).toContain("SettingsToggle");
    expect(layoutSource).toContain("aria-controls=\"pwa-settings-controls\"");
    expect(layoutSource).toContain("pwa-settings-group-hidden");
    expect(layoutSource).toContain("pwa-zoom-controls");
    expect(layoutSource).toContain("APP_ZOOM_KEY");
    expect(layoutSource).toContain("MIN_APP_ZOOM = 0.85");
    expect(layoutSource).toContain("MAX_APP_ZOOM = 1.15");
    expect(layoutSource).toContain("စာလုံးနှင့် website အရွယ်အစား ကြီးရန်");
    expect(layoutSource).toContain("စာလုံးနှင့် website အရွယ်အစား သေးရန်");
    expect(layoutSource).toContain("style={{ zoom: appZoom");
    expect(layoutSource).toContain("marginInline: 'auto'");
    expect(layoutSource).not.toContain("pwa-refresh-guide");
    expect(layoutSource).not.toContain("pwa-refresh-guide-arrow");
    expect(layoutSource).toContain("new-life-ledger:background-music-save");
    expect(layoutSource).toContain("<BackgroundMusicPlayer settingsOpen={settingsOpen} />");
    expect(layoutSource).toContain("<RefreshOverlay />");
    expect(layoutSource).not.toContain("Home — Dashboard သို့ ပြန်သွားမည်");
    expect(layoutSource).toContain('href="/"');
    expect(dashboardSource).toContain("dashboard-loading-status pointer-events-none fixed left-1/2 top-1/2");
    expect(dashboardSource).toContain("-translate-x-1/2 -translate-y-1/2");
  });

  it("uses safe-area-aware spacing and a wider tablet offset", () => {
    expect(cssSource).toContain(".pwa-quick-actions");
    expect(cssSource).toContain("env(safe-area-inset-top, 0px)");
    expect(cssSource).toContain("@media screen and (max-width: 1023px)");
    expect(cssSource).toContain("@media screen and (min-width: 1024px)");
    expect(cssSource).toContain("--pwa-top-clearance: max(env(safe-area-inset-top, 0px), 6.5rem)");
    expect(cssSource).toContain("padding-top: var(--pwa-top-clearance)");
    expect(cssSource).toContain(".pwa-top-alert");
    expect(cssSource).toContain(".pwa-top-loading");
    expect(cssSource).toContain(".pwa-zoom-controls");
    expect(cssSource).toContain(".pwa-settings-toggle");
    expect(cssSource).toContain("calc(var(--pwa-top-clearance) + 3.5rem)");
    expect(cssSource).toContain("calc(var(--pwa-top-clearance) + 7rem)");
    expect(cssSource).toContain("calc(var(--pwa-top-clearance) + 10.5rem)");
    expect(cssSource).toContain("calc(env(safe-area-inset-top, 0px) + 11.5rem)");
    expect(cssSource).not.toContain(".pwa-refresh-guide");
    expect(cssSource).not.toContain("@keyframes pwaRefreshGuideFloat");
  });
});
