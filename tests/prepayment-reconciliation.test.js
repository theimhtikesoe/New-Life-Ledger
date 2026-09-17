import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("prepayment reconciliation and outside settlement status", () => {
  it("adds a dedicated prepayment page and dashboard button", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/prepayment-reconciliation/page.js"), "utf8");
    const dashboard = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
    expect(page).toContain("ကြိုတင်ငွေချေရှိသူများ");
    expect(page).toContain("လက်ရှိကြိုတင်ငွေချေလက်ကျန်");
    expect(page).toContain("sm:grid-cols-2");
    expect(page).not.toContain("NEW LIFE LEDGER · CONTROL ROOM");
    expect(page).not.toContain("ဒီ Page ကို ဘယ်လိုဖတ်မလဲ");
    expect(dashboard).toContain('href="/prepayment-reconciliation"');
  });

  it("keeps outside settlement green after debt increases but clears it on payment", () => {
    const createRoute = readFileSync(resolve(process.cwd(), "src/app/api/customers/[id]/transactions/route.js"), "utf8");
    const updateRoute = readFileSync(resolve(process.cwd(), "src/app/api/transactions/[id]/route.js"), "utf8");
    const settlementRoute = readFileSync(resolve(process.cwd(), "src/app/api/outside-settlements/route.js"), "utf8");
    const customerRoute = readFileSync(resolve(process.cwd(), "src/app/api/customers/route.js"), "utf8");
    expect(createRoute).toContain('...(type === "DEBIT" ? { settledOutsideLedgerAt: null, settledOutsideLedgerBy: null } : {})');
    expect(updateRoute).toContain('...(type === "DEBIT" ? { settledOutsideLedgerAt: null, settledOutsideLedgerBy: null } : {})');
    expect(settlementRoute).toContain("settledOutsideLedgerAt: latest.settledAt");
    expect(customerRoute).toContain("latestSettlement");
    expect(customerRoute).toContain("hasLaterPayment");
  });

  it("registers the new page for every actor and production-only API access", () => {
    const permissions = readFileSync(resolve(process.cwd(), "src/lib/user-permissions.js"), "utf8");
    const middleware = readFileSync(resolve(process.cwd(), "src/middleware.js"), "utf8");
    const header = readFileSync(resolve(process.cwd(), "src/app/layout-client.jsx"), "utf8");
    expect(permissions).toContain("/prepayment-reconciliation");
    expect(middleware).toContain("/api/prepayment-reconciliation");
    expect(header).toContain("/prepayment-reconciliation");
  });
});
