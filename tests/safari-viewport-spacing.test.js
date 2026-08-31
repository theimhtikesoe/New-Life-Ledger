import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("Safari versus standalone PWA top spacing", () => {
  it("keeps website pages flush while reserving the notch-safe PWA clearance", () => {
    expect(source).toContain("--pwa-top-clearance: env(safe-area-inset-top, 0px);");
    expect(source).toContain("padding-top: 0;");
    expect(source).toContain("@media (display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)");
    expect(source).toContain("--pwa-top-clearance: max(env(safe-area-inset-top, 0px), 6.5rem);");
    expect(source).toContain("padding-top: var(--pwa-top-clearance);");
  });
});

export {};

