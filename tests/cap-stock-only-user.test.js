import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pinSource = fs.readFileSync(path.join(root, "src/components/PINLogin.jsx"), "utf8");
const layoutSource = fs.readFileSync(path.join(root, "src/app/layout-client.jsx"), "utf8");
const dashboardSource = fs.readFileSync(path.join(root, "src/components/Dashboard.jsx"), "utf8");

describe("သက်မွန်နှင်း Dashboard and Cap Stock access", () => {
  it("registers the actor and routes the actor to Dashboard", () => {
    expect(pinSource).toContain("သက်မွန်နှင်း");
    expect(pinSource).toContain("completeActorSelection(actorName);");
    expect(layoutSource).toContain("if (normalizedActor === 'သက်မွန်နှင်း') return '/';");
    expect(layoutSource).toContain("normalizedActorName !== 'ဇွဲဇွဲ' && normalizedActorName !== 'ဖြိုးကို'");
    expect(layoutSource).toContain("<Link href=\"/\"");
    expect(dashboardSource).toContain('href="/cap-stock"');
    expect(dashboardSource).toContain("စက်ရုံအဖုံး လက်ကျန်");
    expect(dashboardSource).toContain('const isCapStockDashboard = dashboardActorName === "သက်မွန်နှင်း";');
    expect(dashboardSource).toContain("{isCapStockDashboard ? (");
    expect(dashboardSource).toContain("!isLedgerView && !isCapStockDashboard ? (");
  });

  it("gives menu links a palette distinct from the KPI cards", () => {
    expect(dashboardSource).toContain("border-red-300 bg-red-50");
    expect(dashboardSource).toContain("border-teal-300 bg-teal-50");
    expect(dashboardSource).toContain("border-purple-300 bg-purple-50");
    expect(dashboardSource).toContain("border-yellow-300 bg-yellow-50");
    expect(dashboardSource).toContain("border-lime-300 bg-lime-50");
  });
});
