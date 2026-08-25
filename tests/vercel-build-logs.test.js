import { afterEach, describe, expect, it } from "vitest";
import {
  getVercelBuildLogViewerConfig,
  isAllowedVercelBuildLogActor,
  redactBuildLogText,
} from "@/lib/vercel-build-logs";

describe("Vercel build-log safety helpers", () => {
  const original = {
    token: process.env.VERCEL_API_TOKEN,
    project: process.env.VERCEL_PROJECT_ID,
    actors: process.env.VERCEL_BUILD_LOG_VIEWER_ACTORS,
  };

  afterEach(() => {
    if (original.token === undefined) delete process.env.VERCEL_API_TOKEN;
    else process.env.VERCEL_API_TOKEN = original.token;
    if (original.project === undefined) delete process.env.VERCEL_PROJECT_ID;
    else process.env.VERCEL_PROJECT_ID = original.project;
    if (original.actors === undefined) delete process.env.VERCEL_BUILD_LOG_VIEWER_ACTORS;
    else process.env.VERCEL_BUILD_LOG_VIEWER_ACTORS = original.actors;
  });

  it("redacts configured secret assignments and bearer tokens", () => {
    const result = redactBuildLogText("DATABASE_URL=postgres://secret MANUS_API_KEY:abc123 Authorization: Bearer token-value");
    expect(result).toContain("DATABASE_URL=[REDACTED]");
    expect(result).toContain("MANUS_API_KEY:[REDACTED]");
    expect(result).toContain("Authorization: Bearer [REDACTED]");
    expect(result).not.toContain("secret");
    expect(result).not.toContain("abc123");
    expect(result).not.toContain("token-value");
  });

  it("allows only configured viewer actors", () => {
    process.env.VERCEL_BUILD_LOG_VIEWER_ACTORS = "ဖေဖေ, Staff";
    expect(isAllowedVercelBuildLogActor("ဖေဖေ")).toBe(true);
    expect(isAllowedVercelBuildLogActor("ပုံ့ပုံ့")).toBe(false);
  });

  it("does not report the viewer as configured without both token and project", () => {
    delete process.env.VERCEL_API_TOKEN;
    delete process.env.VERCEL_PROJECT_ID;
    expect(getVercelBuildLogViewerConfig().configured).toBe(false);
  });
});
