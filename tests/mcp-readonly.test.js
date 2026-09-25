import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-session", () => ({ getSessionInfo: vi.fn().mockResolvedValue(null) }));

import { GET } from "../src/app/api/mcp/route.js";
import { createReadonlyMcpServer } from "../src/lib/mcp-readonly.js";

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
});
