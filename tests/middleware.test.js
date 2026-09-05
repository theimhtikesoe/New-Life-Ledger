import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSessionInfo: vi.fn() }));

vi.mock("@/lib/auth-session", () => ({ getSessionInfo: mocks.getSessionInfo }));

import { middleware } from "@/middleware";

function request(path) {
  const url = new URL(`https://example.test${path}`);
  return { nextUrl: { pathname: url.pathname, clone: () => new URL(url) } };
}

describe("API middleware access policy", () => {
  beforeEach(() => mocks.getSessionInfo.mockReset());

  it("requires a session for report status metadata", async () => {
    mocks.getSessionInfo.mockResolvedValue(null);
    const response = await middleware(request("/api/auto-report-status"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: "အရင်ဆုံး PIN ဖြင့် ဝင်ရောက်ပါ။" });
  });

  it("allows an authenticated report status request", async () => {
    mocks.getSessionInfo.mockResolvedValue({ actorName: "ဖေဖေ", access: "full" });
    const response = await middleware(request("/api/auto-report-status"));

    expect(response.status).toBe(200);
  });

  it("protects the balance-changing KPay match alias while keeping external callbacks available", async () => {
    mocks.getSessionInfo.mockResolvedValue(null);
    const matchResponse = await middleware(request("/api/kpay-webhook/match"));
    const webhookResponse = await middleware(request("/api/telegram/order-webhook"));
    const cronResponse = await middleware(request("/api/cron/daily-report"));

    expect(matchResponse.status).toBe(401);
    expect(webhookResponse.status).toBe(200);
    expect(cronResponse.status).toBe(200);
    expect(mocks.getSessionInfo).toHaveBeenCalledTimes(1);
  });

  it("redirects Zway Zway away from every page except Production", async () => {
    mocks.getSessionInfo.mockResolvedValue({ actorName: "ဇွဲဇွဲ", access: "production-only" });
    const productionResponse = await middleware(request("/production"));
    const dashboardResponse = await middleware(request("/"));

    expect(productionResponse.status).toBe(200);
    expect(dashboardResponse.status).toBe(307);
    expect(dashboardResponse.headers.get("location")).toContain("/production");
  });

  it("allows Zway Zway production APIs but rejects non-production APIs", async () => {
    mocks.getSessionInfo.mockResolvedValue({ actorName: "ဇွဲဇွဲ", access: "production-only" });
    const productionResponse = await middleware(request("/api/production-reports"));
    const dashboardApiResponse = await middleware(request("/api/customers"));

    expect(productionResponse.status).toBe(200);
    expect(dashboardApiResponse.status).toBe(403);
  });
});
