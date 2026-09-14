import { describe, expect, it } from "vitest";
import { defaultAllowedPaths, normalizeAllowedPaths, PERMISSION_PAGES } from "@/lib/user-permissions";

describe("Daily PDF download permissions", () => {
  it("lists the daily PDF page in the permission catalog", () => {
    expect(PERMISSION_PAGES).toContainEqual({ path: "/daily-report-download", label: "နေ့စွဲအလိုက် Daily PDF Download" });
  });

  it("includes the daily PDF page in full-user defaults and allows custom records to control it", () => {
    expect(defaultAllowedPaths("ဖေဖေ/မေမေ")).toContain("/daily-report-download");
    expect(normalizeAllowedPaths(["/"], "Rhyzoe")).not.toContain("/daily-report-download");
    expect(normalizeAllowedPaths(["/", "/daily-report-download"], "Rhyzoe")).toContain("/daily-report-download");
  });

  it("does not broaden restricted production or ledger users", () => {
    expect(defaultAllowedPaths("ဇွဲဇွဲ")).not.toContain("/daily-report-download");
    expect(defaultAllowedPaths("ဖြိုးကို")).not.toContain("/daily-report-download");
    expect(defaultAllowedPaths("ဆောင်းဦး")).not.toContain("/daily-report-download");
  });
});
