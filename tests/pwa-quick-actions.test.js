import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layoutSource = fs.readFileSync(path.join(root, "src/app/layout-client.jsx"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");

describe("PWA quick actions", () => {
  it("keeps Refresh and Home in a vertical fixed control stack", () => {
    expect(layoutSource).toContain("pwa-quick-actions");
    expect(layoutSource).toContain('href="/"');
    expect(layoutSource).toContain("Home — Dashboard သို့ ပြန်သွားမည်");
    expect(layoutSource).toContain("h-9 w-9");
    expect(layoutSource).toContain("flex flex-col items-end gap-1.5");
  });

  it("uses safe-area-aware spacing and a wider tablet offset", () => {
    expect(cssSource).toContain(".pwa-quick-actions");
    expect(cssSource).toContain("env(safe-area-inset-top, 0px)");
    expect(cssSource).toContain("@media screen and (min-width: 768px)");
  });
});
