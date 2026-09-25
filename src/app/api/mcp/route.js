import { getSessionInfo } from "@/lib/auth-session";
import { createReadonlyMcpServer } from "@/lib/mcp-readonly";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasValidMcpToken(request) {
  const configured = String(process.env.MCP_READONLY_TOKEN || "").trim();
  const supplied = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return Boolean(configured) && supplied === configured;
}

async function isAuthorized(request) {
  if (hasValidMcpToken(request)) return true;
  return Boolean(await getSessionInfo(request));
}

async function handleMcpRequest(request) {
  if (!(await isAuthorized(request))) {
    return Response.json({ ok: false, error: "MCP token or application session is required." }, { status: 401 });
  }

  // Stateless HTTP keeps this server compatible with serverless execution:
  // every request creates a fresh tool registry and never stores user data in
  // process memory. The bearer token/session remains the authorization layer.
  const server = createReadonlyMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request) {
  return handleMcpRequest(request);
}

export async function GET(request) {
  return handleMcpRequest(request);
}

export async function DELETE(request) {
  return handleMcpRequest(request);
}
