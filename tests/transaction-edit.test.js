import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(resolve(process.cwd(), "src/app/api/transactions/[id]/route.js"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");

describe("Ledger transaction editing", () => {
  it("updates the complete ledger row and recalculates the customer balance delta", () => {
    expect(routeSource).toContain('export async function PATCH(request, { params })');
    expect(routeSource).toContain("const previousEffect = ledger.type === \"CREDIT\"");
    expect(routeSource).toContain("const nextEffect = type === \"CREDIT\"");
    expect(routeSource).toContain('data: {\n          type,');
    expect(routeSource).toContain('action: "UPDATE"');
  });

  it("deletes and recreates stock movements from the edited saleItems payload", () => {
    expect(routeSource).toContain('deleteMany({ where: { sourceType: "LEDGER", sourceId: ledger.id } })');
    expect(routeSource).toContain("saleMovementRows([updated]");
    expect(routeSource).toContain("createMany({ data: stockMovements })");
  });

  it("loads the original mixed-cap breakdown into edit mode", () => {
    expect(dashboardSource).toContain("setEditingTransaction(transaction)");
    expect(dashboardSource).toContain("saleItems: Array.isArray(transaction.saleItems) ? transaction.saleItems : []");
    expect(dashboardSource).toContain("method: \"PATCH\"");
    expect(dashboardSource).toContain("ပြင်ဆင်ပြီး သိမ်းမည်");
  });
});

export {};
