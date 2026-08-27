"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MUSIC_MUTED_KEY = "new-life-ledger:background-music-muted-v1";
const MUSIC_VOLUME = 0.12;
const OVERDUE_LAST_PLAYED_DAY_KEY = "new-life-ledger:overdue-alert-audio-played-day-v2";
const OVERDUE_LAST_AUTO_ATTEMPT_DAY_KEY = "new-life-ledger:overdue-alert-audio-auto-attempt-day-v2";

const TRACKS = [
  {
    name: "Ledger Drift",
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663911487146/YZzdOvvQQGcPdMBE.mp3",
  },
  {
    name: "Ledger Drift 2",
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663911487146/rTYMeMabEYCyQoZh.mp3",
  },
  {
    name: "Ledger Drift 3",
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663911487146/GbZLFEJNeDyjKhyI.mp3",
  },
  {
    name: "Ledger Drift 4",
    src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663911487146/BTQbxwohYQINEhcG.mp3",
  },
];

function readMutedPreference() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUSIC_MUTED_KEY) === "true";
  } catch {
    return false;
  }
}

function readLocalValue(key) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getMyanmarDayKey() {
  if (typeof Intl === "undefined") return new Date().toISOString().slice(0, 10);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Yangon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dispatchMusicEvent(name, detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export default function BackgroundMusicPlayer() {
  const audioRef = useRef(null);
  const shouldPlayRef = useRef(false);
  const mutedRef = useRef(false);
  const trackIndexRef = useRef(0);
  const [trackIndex, setTrackIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [playState, setPlayState] = useState("waiting");

  useEffect(() => {
    const initialMuted = readMutedPreference();
    mutedRef.current = initialMuted;
    setMuted(initialMuted);
  }, []);

  const pauseMusic = useCallback((state = "paused") => {
    shouldPlayRef.current = false;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlayState(state);
  }, []);

  const playCurrentTrack = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !shouldPlayRef.current) return false;

    audio.volume = MUSIC_VOLUME;
    audio.muted = mutedRef.current;
    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") await playPromise;
      setPlayState(mutedRef.current ? "muted" : "playing");
      dispatchMusicEvent("new-life-ledger:background-music-playing", {
        track: TRACKS[trackIndexRef.current]?.name,
      });
      return true;
    } catch (error) {
      console.warn("Background music could not start:", error);
      setPlayState("blocked");
      dispatchMusicEvent("new-life-ledger:background-music-blocked");
      return false;
    }
  }, []);

  const startMusic = useCallback(() => {
    shouldPlayRef.current = true;
    if (mutedRef.current) {
      setPlayState("muted");
      return;
    }
    void playCurrentTrack();
  }, [playCurrentTrack]);

  const handleTrackEnded = useCallback(() => {
    const nextIndex = (trackIndexRef.current + 1) % TRACKS.length;
    trackIndexRef.current = nextIndex;
    setTrackIndex(nextIndex);
  }, []);

  useEffect(() => {
    if (!shouldPlayRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    void playCurrentTrack();
  }, [playCurrentTrack, trackIndex]);

  useEffect(() => {
    const handleOverdueStarted = () => pauseMusic("waiting");
    const handleOverdueBlocked = () => startMusic();
    const handleOverdueEnded = () => startMusic();
    const handleOverdueNotNeeded = () => startMusic();
    const handleOverdueOpened = () => pauseMusic("paused");
    const handleOverdueClosed = () => startMusic();

    window.addEventListener("new-life-ledger:overdue-audio-started", handleOverdueStarted);
    window.addEventListener("new-life-ledger:overdue-audio-blocked", handleOverdueBlocked);
    window.addEventListener("new-life-ledger:overdue-audio-ended", handleOverdueEnded);
    window.addEventListener("new-life-ledger:overdue-audio-not-needed", handleOverdueNotNeeded);
    window.addEventListener("new-life-ledger:overdue-opened", handleOverdueOpened);
    window.addEventListener("new-life-ledger:overdue-closed", handleOverdueClosed);

    return () => {
      window.removeEventListener("new-life-ledger:overdue-audio-started", handleOverdueStarted);
      window.removeEventListener("new-life-ledger:overdue-audio-blocked", handleOverdueBlocked);
      window.removeEventListener("new-life-ledger:overdue-audio-ended", handleOverdueEnded);
      window.removeEventListener("new-life-ledger:overdue-audio-not-needed", handleOverdueNotNeeded);
      window.removeEventListener("new-life-ledger:overdue-opened", handleOverdueOpened);
      window.removeEventListener("new-life-ledger:overdue-closed", handleOverdueClosed);
    };
  }, [pauseMusic, startMusic]);

  useEffect(() => {
    const day = getMyanmarDayKey();
    const playedToday = readLocalValue(OVERDUE_LAST_PLAYED_DAY_KEY) === day;
    const attemptToday = readLocalValue(OVERDUE_LAST_AUTO_ATTEMPT_DAY_KEY) === day;

    // Dashboard data readiness and overdue status are announced by the alert
    // component. A completed alert may safely allow music; an unresolved or
    // blocked alert must keep music stopped.
    const handleOverdueStatus = (event) => {
      if (!event.detail?.ready) return;
      if (!event.detail.hasOverdue || playedToday) {
        startMusic();
      } else if (attemptToday || event.detail.hasOverdue) {
        pauseMusic("waiting");
      }
    };

    window.addEventListener("new-life-ledger:overdue-status-ready", handleOverdueStatus);
    return () => window.removeEventListener("new-life-ledger:overdue-status-ready", handleOverdueStatus);
  }, [pauseMusic, startMusic]);

  const handleMusicButton = () => {
    if (playState === "blocked" && !mutedRef.current) {
      startMusic();
      return;
    }

    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
    try {
      window.localStorage.setItem(MUSIC_MUTED_KEY, String(nextMuted));
    } catch {
      // Private browsing may disable localStorage; the current session still works.
    }

    const audio = audioRef.current;
    if (audio) {
      audio.muted = nextMuted;
      audio.volume = MUSIC_VOLUME;
    }
    if (nextMuted) {
      setPlayState("muted");
    } else {
      startMusic();
    }
  };

  return (
    <div className="pwa-music-control pointer-events-none fixed z-[110]" aria-live="polite">
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        src={TRACKS[trackIndex].src}
        onEnded={handleTrackEnded}
        onError={() => setPlayState("blocked")}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={handleMusicButton}
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-cyan-700 text-white shadow-lg shadow-cyan-950/30 ring-2 ring-cyan-700/20 transition hover:bg-cyan-800 active:scale-95"
        aria-label={muted ? "Background music unmute" : "Background music mute"}
        title={
          playState === "blocked"
            ? "Background music ပြန်ဖွင့်ရန် နှိပ်ပါ"
            : muted
              ? "Background music အသံပြန်ဖွင့်ရန်"
              : "Background music အသံပိတ်ရန်"
        }
      >
        {muted ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4z" />
            <path d="m19 9-6 6m0-6 6 6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        )}
      </button>
    </div>
  );
}
