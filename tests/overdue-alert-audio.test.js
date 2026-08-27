import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const componentPath = path.join(projectRoot, "src/components/OverdueAlertAudio.jsx");
const bellPath = path.join(projectRoot, "src/components/OverdueNotificationBell.jsx");
const assetPath = path.join(projectRoot, "public/audio/overdue-debt-notification.m4a");
const source = fs.readFileSync(componentPath, "utf8");
const bellSource = fs.readFileSync(bellPath, "utf8");

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

  it("stores permission for thirty days and blocks repeat playback on refresh", () => {
    expect(source).toContain("AUDIO_PERMISSION_TTL_MS = 30 * 24 * 60 * 60 * 1000");
    expect(source).toContain("AUDIO_LAST_PLAYED_DAY_KEY");
    expect(source).toContain("AUDIO_LAST_AUTO_ATTEMPT_DAY_KEY");
    expect(source).toContain("getMyanmarDayKey");
    expect(source).toContain("readLocalValue(AUDIO_LAST_PLAYED_DAY_KEY) === today");
    expect(source).toContain("readLocalValue(AUDIO_LAST_AUTO_ATTEMPT_DAY_KEY) === today");
  });

  it("dispatches a close event from every overdue modal close action", () => {
    expect(bellSource).toContain('window.dispatchEvent(new CustomEvent("new-life-ledger:overdue-closed"));');
    expect(bellSource).toContain("onClick={closeModal}");
  });

  it("records completion only after playback reaches the end", () => {
    const playBlock = source.slice(source.indexOf("const playFromStart"), source.indexOf("useEffect(() =>", source.indexOf("const playFromStart")));
    expect(playBlock).not.toContain("rememberDay(AUDIO_LAST_PLAYED_DAY_KEY)");
    expect(source).toContain("const handleEnded");
    expect(source).toContain("rememberDay(AUDIO_LAST_PLAYED_DAY_KEY);");
    expect(source).toContain('new-life-ledger:overdue-opened');
    expect(source).toContain("audio.pause();");
  });
});
