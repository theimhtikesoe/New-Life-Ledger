import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("reconciliation shared header", () => {
  it("maps the page to the standard date and Myanmar clock header", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/layout-client.jsx"), "utf8");
    expect(source).toContain("'/debt-reconciliation': 'အကြွေးဟောင်း စာရင်းညှိခြင်း'");
    expect(source).toContain("formatMyanmarDateLabel(currentTime)");
    expect(source).toContain("formatMyanmarClock(currentTime)");
  });
});
