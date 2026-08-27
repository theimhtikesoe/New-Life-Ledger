import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
const cronPaths = config.crons.map((cron) => cron.path);

describe("Vercel scheduled jobs", () => {
  it("keeps the daily report schedules enabled", () => {
    expect(cronPaths.filter((pathName) => pathName === "/api/cron/daily-report")).toHaveLength(3);
  });

  it("does not schedule the morning auto-order batch yet", () => {
    expect(cronPaths).not.toContain("/api/cron/order-batch");
  });

  it("keeps order trash cleanup separate from morning order delivery", () => {
    expect(cronPaths).toContain("/api/cron/order-trash-cleanup");
  });
});
