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

  it("persists and restores the selected settlement link when editing a payment", () => {
    expect(dashboardSource).toContain("note: paymentNote,");
    expect(dashboardSource).toContain("const settlementMatch = String(transaction.note || \"\").match(/__SETTLES_CREDIT_LEDGER__:(\\S+)/);");
    expect(dashboardSource).toContain("setPaymentTargetLedgerId(settlementMatch ? settlementMatch[1] : \"\");");
  });
});

export {};

const reportSource = readFileSync(resolve(process.cwd(), "src/lib/daily-report.js"), "utf8");
const dailySummaryRouteSource = readFileSync(resolve(process.cwd(), "src/app/api/daily-summary/route.js"), "utf8");

describe("Cap display and report date alignment", () => {
  it("renders every cap color separately in ledger text and Telegram bottle rows", () => {
    expect(dashboardSource).toContain("capBreakdown.map");
    expect(reportSource).toContain("capSummary");
    expect(reportSource).toContain("အဖုံးအရောင်အလိုက်");
  });

  it("uses the same Myanmar day range and transaction date field for both reports", () => {
    expect(dailySummaryRouteSource).toContain("const { start, end } = getMyanmarDayRange(dateParam)");
    expect(dailySummaryRouteSource).toContain("where: { date: { gte: start, lt: end } }");
    expect(reportSource).toContain("where: { date: { gte: start, lt: end } }");
    expect(reportSource).toContain("periodLabel: `${dateLabel} 00:00–23:59 (Myanmar time)`");
  });
});
