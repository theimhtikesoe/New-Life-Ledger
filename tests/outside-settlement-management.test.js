import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("outside settlement management", () => {
  it("prevents duplicate ground-settlement records and supports edit", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/outside-settlements/route.js"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "src/app/balance-detail/page.js"), "utf8");
    expect(route).toContain("DUPLICATE_OUTSIDE_SETTLEMENT");
    expect(route).toContain("export async function PATCH");
    expect(page).toContain("editSettlement");
    expect(page).toContain("deleteSettlement");
    expect(page).toContain("ပြင်ဆင်ပြီး သိမ်းမည်");
  });

  it("hides linked and inferred-paid debt rows from outside settlement choices", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/balance-detail/page.js"), "utf8");
    expect(page).toContain("function outstandingDebtRows");
    expect(page).toContain("__SETTLES_CREDIT_LEDGER__");
    expect(page).toContain("future");
    expect(page).toContain("ကျေပြီးသား အကြွေးများ မပြတော့ပါ");
  });
});
