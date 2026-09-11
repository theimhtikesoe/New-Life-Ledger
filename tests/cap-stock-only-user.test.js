import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pinSource = fs.readFileSync(path.join(root, "src/components/PINLogin.jsx"), "utf8");
const layoutSource = fs.readFileSync(path.join(root, "src/app/layout-client.jsx"), "utf8");
const dashboardSource = fs.readFileSync(path.join(root, "src/components/Dashboard.jsx"), "utf8");

describe("သက်မွန်နှင်း Cap Stock-only access", () => {
  it("registers the actor and restricts the shell to Cap Stock", () => {
    expect(pinSource).toContain("သက်မွန်နှင်း");
    expect(pinSource).toContain("if (CAP_STOCK_ONLY_ACTORS.includes(actorName))");
    expect(pinSource).toContain("completeActorSelection(actorName);");
    expect(layoutSource).toContain("const isCapStockOnlyActor = actorName === 'သက်မွန်နှင်း';");
    expect(layoutSource).toContain("isCapStockOnlyActor && pathname !== '/cap-stock'");
    expect(layoutSource).toContain("isCapStockOnlyActor && pathname === '/cap-stock'");
    expect(layoutSource).toContain("(isCapStockOnlyActor && pathname === '/cap-stock')");
    expect(layoutSource).toContain("normalizedActorName !== 'သက်မွန်နှင်း'");
  });

  it("gives menu links a palette distinct from the KPI cards", () => {
    expect(dashboardSource).toContain("border-red-300 bg-red-50");
    expect(dashboardSource).toContain("border-teal-300 bg-teal-50");
    expect(dashboardSource).toContain("border-purple-300 bg-purple-50");
    expect(dashboardSource).toContain("border-yellow-300 bg-yellow-50");
    expect(dashboardSource).toContain("border-lime-300 bg-lime-50");
  });
});
