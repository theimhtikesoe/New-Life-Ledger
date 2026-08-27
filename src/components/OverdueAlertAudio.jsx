"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const AUDIO_SRC = "/audio/overdue-debt-notification.m4a";
const AUDIO_PERMISSION_KEY = "new-life-ledger:overdue-alert-audio-permission-v2";
const AUDIO_LAST_PLAYED_DAY_KEY = "new-life-ledger:overdue-alert-audio-played-day-v2";
const AUDIO_LAST_AUTO_ATTEMPT_DAY_KEY = "new-life-ledger:overdue-alert-audio-auto-attempt-day-v2";
const AUDIO_LAST_BLOCKED_DAY_KEY = "new-life-ledger:overdue-alert-audio-blocked-day-v2";
const AUDIO_PERMISSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function isAppleTablet() {
  if (typeof navigator === "undefined") return false;
  return /iPad|Macintosh/i.test(navigator.userAgent) && (navigator.maxTouchPoints || 0) > 1;
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

function readLocalValue(key) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing can disable localStorage; the in-memory guard still applies.
  }
}

function readLocalJson(key) {
  const raw = readLocalValue(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function rememberAudioPermission() {
  writeLocalValue(AUDIO_PERMISSION_KEY, JSON.stringify({
    grantedAt: Date.now(),
    expiresAt: Date.now() + AUDIO_PERMISSION_TTL_MS,
  }));
}

function rememberDay(key, day = getMyanmarDayKey()) {
  writeLocalValue(key, day);
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

  const playFromStart = useCallback(async ({ manual = false } = {}) => {
    const audio = audioRef.current;
    if (!audio || playedRef.current) return false;

    if (!manual) {
      // Mark the automatic attempt before calling play so a page refresh during
      // playback cannot trigger the same alert again on the same Myanmar day.
      rememberDay(AUDIO_LAST_AUTO_ATTEMPT_DAY_KEY);
    }

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 1;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") await playPromise;
      playedRef.current = true;
      rememberAudioPermission();
      setPlayState("playing");
      setShowRetryPanel(false);
      setShowSettingsGuide(false);
      return true;
    } catch (error) {
      console.warn("Overdue alert audio could not start:", error);
      setPlayState("blocked");
      setShowRetryPanel(true);
      setShowSettingsGuide(false);
      return false;
    }
  }, []);

  useEffect(() => {
    setIsApple(isAppleTablet());

    const today = getMyanmarDayKey();
    if (readLocalValue(AUDIO_LAST_PLAYED_DAY_KEY) === today) {
      playedRef.current = true;
      setPlayState("played");
      return;
    }

    // A failed/blocked automatic attempt should not repeat after every refresh.
    // It leaves the explicit retry button available instead.
    if (readLocalValue(AUDIO_LAST_AUTO_ATTEMPT_DAY_KEY) === today) {
      // Do not replay or reopen the fallback on every refresh. The original
      // page still had the explicit retry button; the next Myanmar day may
      // make one fresh automatic attempt if permission is still unavailable.
      setPlayState("blocked");
    }
  }, []);

  useEffect(() => {
    if (!hasOverdue || attemptedRef.current || playedRef.current) return;
    attemptedRef.current = true;

    const today = getMyanmarDayKey();
    if (readLocalValue(AUDIO_LAST_PLAYED_DAY_KEY) === today) {
      playedRef.current = true;
      setPlayState("played");
      return;
    }
    if (readLocalValue(AUDIO_LAST_AUTO_ATTEMPT_DAY_KEY) === today) {
      setPlayState("blocked");
      return;
    }

    // Safari/iPadOS may accept this automatic attempt; if not, the explicit
    // retry button is the user-gesture fallback. The day guard above prevents
    // a refresh from starting the same alert again.
    void playFromStart();
  }, [hasOverdue, playFromStart]);

  const handleRetry = () => {
    if (playedRef.current) return;
    setPlayState("idle");
    void playFromStart({ manual: true });
  };

  const handleEnded = () => {
    if (!playedRef.current) return;
    setPlayState("played");
    rememberDay(AUDIO_LAST_PLAYED_DAY_KEY);
    rememberAudioPermission();
  };

  const handleAudioError = () => {
    if (playedRef.current) return;
    const today = getMyanmarDayKey();
    const alreadyBlockedToday = readLocalValue(AUDIO_LAST_BLOCKED_DAY_KEY) === today;
    rememberDay(AUDIO_LAST_BLOCKED_DAY_KEY, today);
    setPlayState("blocked");
    // Show the guide on the first blocked attempt only; a refresh must not
    // repeatedly ask the owner to allow the same audio again.
    if (!alreadyBlockedToday) {
      setShowRetryPanel(true);
      setShowSettingsGuide(false);
    }
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
            Refresh လုပ်ပြီးလည်း အသံကို ထပ်ခါထပ်ခါ မဖွင့်ပါ။ လိုအပ်မှသာ အောက်က ခလုတ်ကို တစ်ချက်နှိပ်ပြီး ပြန်ဖွင့်ပါ။
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
              <p className="mt-2 text-slate-500">Website က System Settings ရဲ့ exact စာမျက်နှာကို အလိုအလျောက်ဖွင့်ပေးခွင့် မရှိသောကြောင့် ဒီအဆင့်တိုကို ပြထားခြင်းဖြစ်ပါသည်။ Allow အတည်ပြုပြီးနောက် website က preference ကို ၃၀ ရက်အထိ မှတ်ထားပါမည်။</p>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
