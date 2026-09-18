import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(process.cwd(), "src/app/factory-stock/page.js"), "utf8");
const routeSource = readFileSync(resolve(process.cwd(), "src/app/api/factory-stock/route.js"), "utf8");

describe("Factory Stock new bottle visibility", () => {
  it("invalidates the previous cached catalog response", () => {
    expect(pageSource).toContain('new-life-ledger:factory-stock-v2');
    expect(pageSource).not.toContain('new-life-ledger:factory-stock-v1');
  });

  it("builds stock rows from the canonical bottle catalog even without movements", () => {
    expect(routeSource).toContain("buildCatalog().filter((entry) => entry.productType === \"bottle\"");
    expect(routeSource).toContain("if (!summaryByKey.has(item.productKey))");
  });
});
