import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layout = readFileSync(resolve(process.cwd(), "src/app/layout-client.jsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("weather overlay visuals", () => {
  it("makes rain more visible without blocking the UI", () => {
    expect(layout).toContain("Array.from({ length: 52 }");
    expect(styles).toContain("rgba(59, 130, 246, 0.42)");
    expect(styles).toContain("pointer-events: none");
  });

  it("shows falling maple leaves on sunny mornings", () => {
    expect(layout).toContain("const sunnyMorning = sunny && currentHour >= 6 && currentHour < 12;");
    expect(layout).toContain("Array.from({ length: 15 }");
    expect(layout).toContain(">🍁</i>");
    expect(styles).toContain(".weather-leaves i");
    expect(styles).toContain("@keyframes weatherLeafFall");
  });

  it("respects reduced-motion preferences", () => {
    expect(styles).toContain(".weather-leaves i { animation: none; display: none; }");
  });
});
