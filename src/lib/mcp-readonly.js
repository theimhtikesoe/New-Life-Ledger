import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GET as getDashboardKpi } from "@/app/api/dashboard-kpi/route";
import { GET as getOverdueDebts } from "@/app/api/overdue-debts/route";
import { GET as getCustomers } from "@/app/api/customers/route";
import { GET as getCustomerTransactions } from "@/app/api/customers/[id]/transactions/route";
import { GET as getPriceSettings } from "@/app/api/price-settings/route";
import { GET as getPackagingReport } from "@/app/api/monthly-packaging-bag-report/route";
import { GET as getProductionReports } from "@/app/api/production-reports/route";
import { GET as getAutoReportStatus } from "@/app/api/auto-report-status/route";
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";

const BASE_URL = "http://new-life-ledger.local";

function currentMonth() {
  return getMyanmarDateInputValue().slice(0, 7);
}

async function readRouteResponse(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Internal report request failed (${response.status})`);
  return body.data ?? body;
}

async function callGet(handler, path, params = {}, context) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") search.set(key, String(value));
  }
  const request = new Request(`${BASE_URL}${path}${search.toString() ? `?${search}` : ""}`);
  return readRouteResponse(await handler(request, context));
}

function textResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function createReadonlyMcpServer() {
  const server = new McpServer({
    name: "new-life-ledger-readonly",
    version: "1.0.0",
  });

  server.tool(
    "get_dashboard_summary",
    "Read the accounting, sales, customer, and stock KPI summary for a Myanmar calendar date. This tool never changes data.",
    { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Myanmar date in YYYY-MM-DD format") },
    async ({ date }) => textResult(await callGet(getDashboardKpi, "/api/dashboard-kpi", { date: date || getMyanmarDateInputValue() })),
  );

  server.tool(
    "get_overdue_debts",
    "Read customers whose debt is overdue according to the project's existing debt rules. This tool never changes data.",
    {},
    async () => textResult(await callGet(getOverdueDebts, "/api/overdue-debts")),
  );

  server.tool(
    "search_customer",
    "Search customers by name or phone number. Ledger and cash-sale details are excluded to keep this lookup small.",
    { query: z.string().min(1).max(100).describe("Customer name or phone search text") },
    async ({ query }) => textResult(await callGet(getCustomers, "/api/customers", { q: query, includeLedgers: "false", includeCashSales: "false" })),
  );

  server.tool(
    "get_customer_ledger",
    "Read one customer's ledger and pagination data for an optional date range. This tool never changes data.",
    {
      customerId: z.string().uuid().describe("Customer UUID"),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
    async ({ customerId, startDate, endDate, limit }) => textResult(await callGet(
      getCustomerTransactions,
      `/api/customers/${encodeURIComponent(customerId)}/transactions`,
      { startDate, endDate, limit: limit || 100, includeCount: "true" },
      { params: { id: customerId } },
    )),
  );

  server.tool(
    "get_price_settings",
    "Read effective item and category prices for a date, including the existing carry-forward behavior. This tool never changes prices.",
    { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Price date in YYYY-MM-DD format") },
    async ({ date }) => textResult(await callGet(getPriceSettings, "/api/price-settings", { date: date || getMyanmarDateInputValue() })),
  );

  server.tool(
    "get_packaging_bag_report",
    "Read the monthly packaging-bag report, including groups, daily totals, and unassigned items. This tool never changes data.",
    { month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Month in YYYY-MM format") },
    async ({ month }) => textResult(await callGet(getPackagingReport, "/api/monthly-packaging-bag-report", { month: month || currentMonth() })),
  );

  server.tool(
    "get_production_summary",
    "Read production report rows for a date, optionally filtered by bottle or tube category. This tool never changes production data.",
    {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      category: z.enum(["bottle", "tube"]).optional(),
    },
    async ({ date, category }) => textResult(await callGet(getProductionReports, "/api/production-reports", { date: date || getMyanmarDateInputValue(), category })),
  );

  server.tool(
    "get_auto_report_status",
    "Read the latest automated/manual report delivery status and recent history. This tool never sends a report.",
    {},
    async () => textResult(await callGet(getAutoReportStatus, "/api/auto-report-status")),
  );

  return server;
}
