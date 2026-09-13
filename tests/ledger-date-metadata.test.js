import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const createRoute = readFileSync(resolve(process.cwd(), "src/app/api/customers/[id]/transactions/route.js"), "utf8");
const editRoute = readFileSync(resolve(process.cwd(), "src/app/api/transactions/[id]/route.js"), "utf8");
const dashboard = readFileSync(resolve(process.cwd(), "src/components/Dashboard.jsx"), "utf8");
const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

describe("Ledger date and save metadata", () => {
  it("stores the selected Myanmar ledger date separately from the database save timestamp", () => {
    expect(createRoute).toContain("const ledgerDate = body.date || todayMyanmar;");
    expect(createRoute).toContain("date: getMyanmarDayRange(ledgerDate).start");
    expect(createRoute).toContain("createdAt: true, actorName: true");
    expect(schema).toContain("actorName      String?");
  });

  it("records the actor on create and edit while retaining createdAt", () => {
    expect(createRoute).toContain("customerId, actorName: getActorName(request), type");
    expect(editRoute).toContain("actorName: getActorName(request)");
    expect(editRoute).toContain("createdAt: true, actorName: true");
  });

  it("labels all three customer ledger facts distinctly", () => {
    expect(dashboard).toContain("စာရင်းရက် (Myanmar)");
    expect(dashboard).toContain("သိမ်းသူ:");
    expect(dashboard).toContain("ledger.createdAt ? formatDate(ledger.createdAt)");
  });
});

export {};
