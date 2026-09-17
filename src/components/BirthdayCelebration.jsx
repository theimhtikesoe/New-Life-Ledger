"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getMyanmarDateInputValue } from "@/lib/myanmar-time";

const BIRTHDAY_DATE = "2026-09-21";
const SHOWN_KEY = "new-life-ledger:hnin-oo-birthday-2026";

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

export default function BirthdayCelebration() {
  const [open, setOpen] = useState(false);
  const [songPlaying, setSongPlaying] = useState(false);
  const audioContextRef = useRef(null);
  const songTimersRef = useRef([]);
  const confetti = useMemo(makeConfetti, []);

  const stopBirthdaySong = () => {
    songTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    songTimersRef.current = [];
    try {
      audioContextRef.current?.close();
    } catch {
      // The browser may already have closed the audio context.
    }
    audioContextRef.current = null;
    setSongPlaying(false);
  };

  const playBirthdaySong = () => {
    stopBirthdaySong();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    audioContextRef.current = context;
    const notes = [
      [392, 0.22], [392, 0.22], [440, 0.44], [392, 0.44], [523.25, 0.44], [493.88, 0.8],
      [392, 0.22], [392, 0.22], [440, 0.44], [392, 0.44], [587.33, 0.44], [523.25, 0.8],
      [392, 0.22], [392, 0.22], [783.99, 0.44], [659.25, 0.44], [523.25, 0.44], [493.88, 0.44], [440, 0.8],
      [698.46, 0.22], [698.46, 0.22], [659.25, 0.44], [523.25, 0.44], [587.33, 0.44], [523.25, 0.9],
    ];
    let offset = 0;
    notes.forEach(([frequency, duration]) => {
      const timer = window.setTimeout(() => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration - 0.03);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + duration);
      }, offset * 1000);
      songTimersRef.current.push(timer);
      offset += duration;
    });
    const finishTimer = window.setTimeout(stopBirthdaySong, offset * 1000 + 100);
    songTimersRef.current.push(finishTimer);
    setSongPlaying(true);
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
    const timer = window.setInterval(() => {
      if (getMyanmarDateInputValue() !== BIRTHDAY_DATE) setOpen(false);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => () => stopBirthdaySong(), []);

  if (!open) return null;
  return (
    <div className="birthday-celebration" role="presentation">
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
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={playBirthdaySong} className="birthday-close" aria-pressed={songPlaying}>
            {songPlaying ? "မွေးနေ့သီချင်း ဖွင့်နေသည် ♪" : "မွေးနေ့သီချင်း ဖွင့်ရန် ♪"}
          </button>
          <button type="button" onClick={() => { stopBirthdaySong(); setOpen(false); }} className="birthday-close">ကျေးဇူးတင်ပါတယ် ♥</button>
        </div>
      </section>
    </div>
  );
}
