import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("Customer list responsive navigation", () => {
  it("keeps the Customer list show/hide control", () => {
    expect(source).toContain("Customer စာရင်းပြမည်");
    expect(source).toContain("Customer စာရင်းဖျောက်မည်");
    expect(source).toContain("setShowCustomerList(!showCustomerList)");
  });

  it("shows a contextual clear button when a search value exists", () => {
    expect(source).toContain('aria-label="Customer ရှာဖွေမှု ရှင်းရန်"');
    expect(source).toContain('onClick={() => setSearch("")}');
    expect(source).toContain("pr-10");
    expect(source).toContain("{search ? (");
  });

  it("does not render the unnecessary detail-page return button", () => {
    expect(source).not.toContain("Customer List သို့ပြန်ရန်");
  });
});
