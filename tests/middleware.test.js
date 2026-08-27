import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requestHasValidSession: vi.fn() }));

vi.mock("@/lib/auth-session", () => ({ requestHasValidSession: mocks.requestHasValidSession }));

import { middleware } from "@/middleware";

function request(path) {
  return { nextUrl: { pathname: path } };
}

describe("API middleware access policy", () => {
  beforeEach(() => mocks.requestHasValidSession.mockReset());

  it("requires a session for report status metadata", async () => {
    mocks.requestHasValidSession.mockResolvedValue(false);
    const response = await middleware(request("/api/auto-report-status"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: "အရင်ဆုံး PIN ဖြင့် ဝင်ရောက်ပါ။" });
  });

  it("allows an authenticated report status request", async () => {
    mocks.requestHasValidSession.mockResolvedValue(true);
    const response = await middleware(request("/api/auto-report-status"));

    expect(response.status).toBe(200);
  });

  it("protects the balance-changing KPay match alias while keeping external callbacks available", async () => {
    mocks.requestHasValidSession.mockResolvedValue(false);
    const matchResponse = await middleware(request("/api/kpay-webhook/match"));
    const webhookResponse = await middleware(request("/api/telegram/order-webhook"));
    const cronResponse = await middleware(request("/api/cron/daily-report"));

    expect(matchResponse.status).toBe(401);
    expect(webhookResponse.status).toBe(200);
    expect(cronResponse.status).toBe(200);
    expect(mocks.requestHasValidSession).toHaveBeenCalledTimes(1);
  });
});
