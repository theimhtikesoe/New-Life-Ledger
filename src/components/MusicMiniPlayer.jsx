"use client";

import { useEffect, useState } from "react";

const MUSIC_STATE_EVENT = "new-life-ledger:background-music-state";
const MUSIC_COMMAND_EVENT = "new-life-ledger:background-music-command";

function sendCommand(action) {
  window.dispatchEvent(new CustomEvent(MUSIC_COMMAND_EVENT, { detail: { action } }));
}

export default function MusicMiniPlayer() {
  const [state, setState] = useState({ track: "New Life", playState: "waiting", muted: false });

  useEffect(() => {
    const handleState = (event) => setState((current) => ({ ...current, ...(event.detail || {}) }));
    window.addEventListener(MUSIC_STATE_EVENT, handleState);
    return () => window.removeEventListener(MUSIC_STATE_EVENT, handleState);
  }, []);

  const paused = state.playState === "paused" || state.playState === "waiting" || state.playState === "blocked";
  return (
    <div className="music-mini-player mx-auto mt-2 flex w-fit max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-1 shadow-sm" aria-label="Background music player">
      <span className="music-mini-track max-w-[112px] truncate px-1.5 text-[10px] font-bold text-slate-600" title={state.track}>{state.track}</span>
      <button type="button" onClick={() => sendCommand("previous")} className="music-mini-button" aria-label="ယခင်သီချင်း" title="ယခင်သီချင်း">⏮</button>
      <button type="button" onClick={() => sendCommand("playPause")} className="music-mini-button music-mini-main" aria-label={paused ? "သီချင်းဖွင့်ရန်" : "သီချင်းရပ်ရန်"} title={paused ? "ဖွင့်ရန်" : "ခဏရပ်ရန်"}>{paused ? "▶" : "Ⅱ"}</button>
      <button type="button" onClick={() => sendCommand("next")} className="music-mini-button" aria-label="နောက်သီချင်း" title="နောက်သီချင်း">⏭</button>
      <button type="button" onClick={() => sendCommand("mute")} className="music-mini-button" aria-label={state.muted ? "အသံဖွင့်ရန်" : "အသံပိတ်ရန်"} title={state.muted ? "အသံဖွင့်ရန်" : "အသံပိတ်ရန်"}>{state.muted ? "🔇" : "🔊"}</button>
    </div>
  );
}
