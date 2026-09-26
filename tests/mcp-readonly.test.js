import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-session", () => ({ getSessionInfo: vi.fn().mockResolvedValue(null) }));

import { GET } from "../src/app/api/mcp/route.js";
import { compactPackagingReport, createReadonlyMcpServer } from "../src/lib/mcp-readonly.js";

describe("read-only MCP server", () => {
  it("registers the Phase 1 business tools without write tools", () => {
    const server = createReadonlyMcpServer();
    const names = Object.keys(server._registeredTools).sort();
    expect(names).toEqual([
      "get_auto_report_status",
      "get_customer_ledger",
      "get_dashboard_summary",
      "get_overdue_debts",
      "get_packaging_bag_report",
      "get_price_settings",
      "get_production_summary",
      "search_customer",
    ]);
    expect(names.some((name) => /create|save|update|delete|send|match/i.test(name))).toBe(false);
  });

  it("rejects requests without an MCP token or app session", async () => {
    const response = await GET(new Request("http://localhost/api/mcp"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("keeps packaging totals and groups while omitting raw daily records by default", () => {
    const result = compactPackagingReport({
      month: "2026-09",
      days: 23,
      records: 176,
      totalPackagingPieces: 3904,
      totalPackagingWeightLb: 7383.49,
      totalPieces: 129458,
      groups: [{ bagSize: "38×58", label: "38×58", packagingPieces: 1740, packagingWeightLb: 1135.05, pieces: 289730, items: [{ label: "အမျိုးအစား A", quantity: 86, capacity: 100, unit: "ကဒ်" }] }],
      daily: [{ date: "2026-09-25", totalPackagingPieces: 100, totalPackagingWeightLb: 42, totalPieces: 3000 }],
    });
    expect(result).toMatchObject({ month: "2026-09", totalPackagingPieces: 3904, totalPackagingWeightLb: 7383.49, totalPieces: 129458 });
    expect(result.groups).toEqual([{ bagSize: "38×58", label: "38×58", packagingPieces: 1740, packagingWeightLb: 1135.05, bottlePieces: 289730 }]);
    expect(result.daily).toBeUndefined();
  });
});
