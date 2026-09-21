"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";

const BIRTHDAY_DATE = "2026-09-21";
const SHOWN_KEY = "new-life-ledger:hnin-oo-birthday-2026";
const BIRTHDAY_SONG_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663960207676/vaRnchUJftQkvJhd.mp3";

function makeConfetti() {
  return Array.from({ length: 72 }, (_, index) => ({
    id: index,
    left: `${(index * 37) % 101}%`,
    delay: `${(index % 18) * 0.11}s`,
    duration: `${3.8 + (index % 8) * 0.32}s`,
    rotate: `${(index * 47) % 360}deg`,
    color: ["#f43f5e", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ec4899"][index % 6],
  }));
}

function dispatchBirthdayAudioEvent(name) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name));
}

export default function BirthdayCelebration() {
  const [open, setOpen] = useState(false);
  const [songPlaying, setSongPlaying] = useState(false);
  const [songBlocked, setSongBlocked] = useState(false);
  const audioRef = useRef(null);
  const confetti = useMemo(makeConfetti, []);

  const stopBirthdaySong = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setSongPlaying(false);
  };

  const playBirthdaySong = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setSongBlocked(false);
      setSongPlaying(true);
    } catch {
      // Mobile Safari may require the visible button to be tapped first.
      setSongBlocked(true);
      setSongPlaying(false);
    }
  };

  useEffect(() => {
    if (getMyanmarDateInputValue() !== BIRTHDAY_DATE) return;
    try {
      if (window.localStorage.getItem(SHOWN_KEY) === BIRTHDAY_DATE) return;
      window.localStorage.setItem(SHOWN_KEY, BIRTHDAY_DATE);
    } catch {
      // If storage is unavailable, the birthday effect still works for this visit.
    }
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    dispatchBirthdayAudioEvent("new-life-ledger:birthday-audio-active");
    // Let the audio element commit before attempting autoplay. If Safari has
    // not granted autoplay yet, the first ordinary tap/keypress retries it so
    // the user does not need to find and press a separate song button.
    const startTimer = window.setTimeout(() => { void playBirthdaySong(); }, 0);
    const retryOnInteraction = () => { void playBirthdaySong(); };
    window.addEventListener("pointerdown", retryOnInteraction, { once: true, passive: true });
    window.addEventListener("keydown", retryOnInteraction, { once: true });
    const timer = window.setInterval(() => {
      if (getMyanmarDateInputValue() !== BIRTHDAY_DATE) {
        stopBirthdaySong();
        setOpen(false);
        dispatchBirthdayAudioEvent("new-life-ledger:birthday-audio-ended");
      }
    }, 1000);
    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", retryOnInteraction);
      window.removeEventListener("keydown", retryOnInteraction);
    };
  }, [open]);

  useEffect(() => () => {
    stopBirthdaySong();
    dispatchBirthdayAudioEvent("new-life-ledger:birthday-audio-ended");
  }, []);

  if (!open) return null;
  return (
    <div className="birthday-celebration" role="presentation">
      <audio
        ref={audioRef}
        src={BIRTHDAY_SONG_URL}
        preload="auto"
        loop
        onPlay={() => setSongPlaying(true)}
        onPause={() => setSongPlaying(false)}
        onError={() => setSongBlocked(true)}
        aria-label="Birthday song"
      />
      <div className="birthday-fireworks" aria-hidden="true">
        {["18%", "50%", "82%"].map((left, burstIndex) => (
          <div key={left} className="birthday-burst" style={{ left, top: `${24 + burstIndex * 5}%`, animationDelay: `${burstIndex * 0.35}s` }}>
            {Array.from({ length: 14 }, (_, ray) => <i key={ray} style={{ transform: `rotate(${ray * (360 / 14)}deg)` }} />)}
          </div>
        ))}
      </div>
      <div className="birthday-confetti" aria-hidden="true">
        {confetti.map((piece) => <i key={piece.id} style={{ left: piece.left, animationDelay: piece.delay, animationDuration: piece.duration, backgroundColor: piece.color, transform: `rotate(${piece.rotate})` }} />)}
      </div>
      <section className="birthday-alert" role="alertdialog" aria-modal="true" aria-labelledby="birthday-alert-title">
        <div className="birthday-cake" aria-hidden="true">🎂</div>
        <p className="birthday-kicker">A special celebration</p>
        <h2 id="birthday-alert-title">Happy Hnin Oo Day 🎉</h2>
        <p className="birthday-message">မွေးနေ့မှစပြီး ပျော်ရွှင်ခြင်း၊ ကျန်းမာခြင်းတွေနဲ့ ပြည့်စုံပါစေ။</p>
        <p className="mt-2 text-xs text-slate-600">၂၁ ရက်နေ့အတွက် သီးသန့် Birthday song</p>
        <p className="birthday-song-status" role="status" aria-live="polite">
          {songPlaying ? "Birthday song ဖွင့်နေသည် ♪" : songBlocked ? "အသံခွင့်ပြုရန် screen ကို တစ်ချက်ထိပါ ♪" : "Birthday song ဖွင့်နေပါသည်..."}
        </p>
        <button type="button" onClick={() => { stopBirthdaySong(); setOpen(false); }} className="birthday-close">ကျေးဇူးတင်ပါတယ် ♥</button>
      </section>
    </div>
  );
}

export { BIRTHDAY_DATE, BIRTHDAY_SONG_URL };
