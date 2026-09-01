import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const layoutSource = fs.readFileSync(path.join(projectRoot, "src/app/layout-client.jsx"), "utf8");
const navigationFiles = [
  "src/components/Dashboard.jsx",
  "src/app/activity/page.js",
  "src/app/auto-report-status/page.js",
  "src/app/balance-detail/page.js",
  "src/app/daily-summary/page.js",
  "src/app/data-management/page.js",
  "src/app/orders/page.js",
  "src/app/vercel-build-logs/page.js",
];

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("Persistent audio navigation", () => {
  it("mounts the background player beside children in the authenticated root shell", () => {
    expect(layoutSource).toContain("{children}");
    expect(layoutSource).toContain("<BackgroundMusicPlayer settingsOpen={settingsOpen} />");
  });

  it("uses Next Link for internal routes instead of full document anchors", () => {
    navigationFiles.forEach((relativePath) => {
      const source = readSource(relativePath);
      expect(source, relativePath).toContain('import Link from "next/link";');
      expect(source, relativePath).not.toContain('<a href="/');
      expect(source, relativePath).not.toContain('<a href={`/' );
      expect(source, relativePath).not.toContain('<a\n');
    });
  });
});
