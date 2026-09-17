import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultAllowedPaths, normalizeAllowedPaths, RECONCILIATION_PAGE_PATH } from "@/lib/user-permissions";

describe("reconciliation permission access", () => {
  it("includes the shared reconciliation page in every built-in actor policy", () => {
    ["ဖေဖေ/မေမေ", "ပုံ့ပုံ့", "ဆောင်းဦး", "ဇွဲဇွဲ", "ဖြိုးကို", "Rhyzoe", "သက်မွန်နှင်း"].forEach((actor) => {
      expect(defaultAllowedPaths(actor)).toContain(RECONCILIATION_PAGE_PATH);
      expect(normalizeAllowedPaths([], actor)).toContain(RECONCILIATION_PAGE_PATH);
    });
  });

  it("does not let production-only API restrictions block reconciliation", () => {
    const middleware = readFileSync(resolve(process.cwd(), "src/middleware.js"), "utf8");
    expect(middleware).toContain("SHARED_RECONCILIATION_API_PATHS");
    expect(middleware).toContain('"/api/debt-reconciliation"');
    expect(middleware).toContain('!SHARED_RECONCILIATION_API_PATHS.has(path)');
  });
});
