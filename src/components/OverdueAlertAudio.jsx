"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const AUDIO_SRC = "/audio/overdue-debt-notification.m4a";
const AUDIO_PLAYED_KEY = "new-life-ledger:overdue-alert-audio-played-v1";
const AUDIO_GESTURE_KEY = "new-life-ledger:audio-gesture-v1";

function isAppleTablet() {
  if (typeof navigator === "undefined") return false;
  return /iPad|Macintosh/i.test(navigator.userAgent) && (navigator.maxTouchPoints || 0) > 1;
}

function readSessionFlag(key) {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeSessionFlag(key) {
  try {
    window.sessionStorage.setItem(key, "true");
  } catch {
    // Private browsing can disable sessionStorage; playback still works for this render.
  }
}

export default function OverdueAlertAudio({ overdueDebts = [], ready = false }) {
  const audioRef = useRef(null);
  const attemptedRef = useRef(false);
  const playedRef = useRef(false);
  const [playState, setPlayState] = useState("idle");
  const [showRetryPanel, setShowRetryPanel] = useState(false);
  const [showSettingsGuide, setShowSettingsGuide] = useState(false);
  const [isApple, setIsApple] = useState(false);

  const hasOverdue = ready && Array.isArray(overdueDebts) && overdueDebts.length > 0;

  const playFromStart = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || playedRef.current) return false;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 1;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") await playPromise;
      playedRef.current = true;
      setPlayState("playing");
      setShowRetryPanel(false);
      setShowSettingsGuide(false);
      return true;
    } catch (error) {
      console.warn("Overdue alert audio could not start:", error);
      setPlayState("blocked");
      setShowRetryPanel(true);
      setShowSettingsGuide(true);
      return false;
    }
  }, []);

  useEffect(() => {
    setIsApple(isAppleTablet());
    if (readSessionFlag(AUDIO_PLAYED_KEY)) {
      playedRef.current = true;
      setPlayState("played");
    }
  }, []);

  useEffect(() => {
    if (!hasOverdue || attemptedRef.current || playedRef.current) return;
    attemptedRef.current = true;

    // The PIN/actor selection is a user gesture. The audio element is already
    // mounted here so Safari/iPadOS has a chance to accept the following play.
    const gestureWasGranted = readSessionFlag(AUDIO_GESTURE_KEY);
    if (gestureWasGranted) {
      void playFromStart();
      return;
    }

    // If a browser did not retain the earlier gesture, still make one automatic
    // attempt; the visible retry button becomes the explicit user gesture fallback.
    void playFromStart();
  }, [hasOverdue, playFromStart]);

  const handleRetry = () => {
    playedRef.current = false;
    setPlayState("idle");
    void playFromStart();
  };

  const handleEnded = () => {
    setPlayState("played");
    writeSessionFlag(AUDIO_PLAYED_KEY);
  };

  const handleAudioError = () => {
    if (playedRef.current) return;
    setPlayState("blocked");
    setShowRetryPanel(true);
    setShowSettingsGuide(true);
  };

  return (
    <>
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        src={AUDIO_SRC}
        onEnded={handleEnded}
        onError={handleAudioError}
        aria-hidden="true"
      />
      {hasOverdue && playState !== "playing" && playState !== "played" && showRetryPanel && (
        <aside className="fixed bottom-4 left-4 z-[100] w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-rose-200 bg-white/95 p-4 text-slate-800 shadow-2xl shadow-rose-200/60 backdrop-blur" role="status" aria-live="polite">
          <p className="text-sm font-bold text-rose-700">အကြွေးသတိပေးအသံ မထွက်သေးပါ</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            အောက်က ခလုတ်ကို တစ်ချက်နှိပ်ပြီး အသံကို တစ်ခေါက်တည်း ပြန်ဖွင့်ပါ။ iPad မှာ မရသေးရင် Settings လမ်းညွှန်ကို ကြည့်ပါ။
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={handleRetry} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-700 active:scale-95">
              အသံဖွင့်ရန်
            </button>
            <button type="button" onClick={() => setShowSettingsGuide((current) => !current)} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-95">
              {isApple ? "iPad Allow လမ်းညွှန်" : "Allow လမ်းညွှန်"}
            </button>
          </div>
          {showSettingsGuide && (
            <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50/70 p-3 text-[11px] leading-5 text-slate-700">
              <p className="font-bold text-cyan-800">iPad PWA / Safari</p>
              <p className="mt-1">Settings → Apps → Safari → Auto-Play → Allow All Auto-Play ကို ရွေးပြီး website ကို ပြန်ဖွင့်ပါ။ Safari ထဲတွင်ဖွင့်ထားပါက address bar ရှိ aA → Website Settings → Auto-Play → Allow ကို ရွေးနိုင်ပါသည်။</p>
              <p className="mt-2 text-slate-500">Website က System Settings ရဲ့ exact စာမျက်နှာကို အလိုအလျောက်ဖွင့်ပေးခွင့် မရှိသောကြောင့် ဒီအဆင့်တိုကို ပြထားခြင်းဖြစ်ပါသည်။</p>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
