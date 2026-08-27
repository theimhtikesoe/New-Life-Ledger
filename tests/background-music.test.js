import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const componentPath = path.join(process.cwd(), "src/components/BackgroundMusicPlayer.jsx");
const source = fs.readFileSync(componentPath, "utf8");

describe("Background music player", () => {
  it("contains the four uploaded playlist tracks and keeps music quiet", () => {
    expect(source).toContain("Ledger Drift");
    expect(source).toContain("Ledger Drift 2");
    expect(source).toContain("Ledger Drift 3");
    expect(source).toContain("Ledger Drift 4");
    expect(source).toContain("const MUSIC_VOLUME = 0.12;");
    expect((source.match(/files\.manuscdn\.com\/user_upload_by_module/g) || []).length).toBe(4);
  });

  it("waits for overdue audio events and provides a persisted mute control", () => {
    expect(source).toContain("new-life-ledger:overdue-audio-started");
    expect(source).toContain("new-life-ledger:overdue-audio-ended");
    expect(source).toContain("new-life-ledger:overdue-opened");
    expect(source).toContain("MUSIC_MUTED_KEY");
    expect(source).toContain("new-life-ledger:background-music-blocked");
    expect(source).toContain("aria-label={muted ? \"Background music unmute\" : \"Background music mute\"}");
  });
});
