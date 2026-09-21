import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const birthdaySource = fs.readFileSync(path.join(root, "src/components/BirthdayCelebration.jsx"), "utf8");
const layoutSource = fs.readFileSync(path.join(root, "src/app/layout-client.jsx"), "utf8");
const dashboardSource = fs.readFileSync(path.join(root, "src/components/Dashboard.jsx"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");

describe("Happy Hnin Oo Day celebration", () => {
  it("mounts outside the zoomed scrolling shell so the celebration stays fixed", () => {
    expect(layoutSource).toContain("import BirthdayCelebration from '@/components/BirthdayCelebration';");
    expect(layoutSource).toContain("<BirthdayCelebration />");
    expect(dashboardSource).not.toContain("BirthdayCelebration");
    expect(cssSource).toContain(".birthday-celebration {");
    expect(cssSource).toContain("position: fixed;");
  });

  it("attempts autoplay after the audio element commits and retries on the first interaction", () => {
    expect(birthdaySource).toContain("window.setTimeout(() => { void playBirthdaySong(); }, 0)");
    expect(birthdaySource).toContain('window.addEventListener("pointerdown", retryOnInteraction');
    expect(birthdaySource).toContain('window.addEventListener("keydown", retryOnInteraction');
    expect(birthdaySource).toContain('preload="auto"');
    expect(birthdaySource).not.toContain("Birthday song ဖွင့်ရန် ♪");
  });
});
