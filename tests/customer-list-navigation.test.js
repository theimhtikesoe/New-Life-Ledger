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

  it("does not render the unnecessary detail-page return button", () => {
    expect(source).not.toContain("Customer List သို့ပြန်ရန်");
  });
});
