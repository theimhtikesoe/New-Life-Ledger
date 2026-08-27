import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const componentPath = path.join(projectRoot, "src/components/OverdueAlertAudio.jsx");
const assetPath = path.join(projectRoot, "public/audio/overdue-debt-notification.m4a");
const source = fs.readFileSync(componentPath, "utf8");

describe("Overdue alert audio feature", () => {
  it("ships the owner-provided audio asset in the web app", () => {
    expect(fs.existsSync(assetPath)).toBe(true);
    expect(fs.statSync(assetPath).size).toBeGreaterThan(1000);
  });

  it("uses a single non-looping audio element with an explicit retry fallback", () => {
    expect(source).toContain('src={AUDIO_SRC}');
    expect(source).toContain('preload="auto"');
    expect(source).toContain("playsInline");
    expect(source).toContain("audio.play()");
    expect(source).not.toContain("loop");
    expect(source).toContain("အသံဖွင့်ရန်");
    expect(source).toContain("iPad PWA / Safari");
  });

  it("records completion only after playback reaches the end", () => {
    const playBlock = source.slice(source.indexOf("const playFromStart"), source.indexOf("useEffect(() =>", source.indexOf("const playFromStart")));
    expect(playBlock).not.toContain("writeSessionFlag(AUDIO_PLAYED_KEY)");
    expect(source).toContain("const handleEnded");
    expect(source).toContain("writeSessionFlag(AUDIO_PLAYED_KEY);");
  });
});
