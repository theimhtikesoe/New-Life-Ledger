"use client";

import { useEffect, useMemo, useState } from "react";
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
  const confetti = useMemo(makeConfetti, []);

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
        <button type="button" onClick={() => setOpen(false)} className="birthday-close">ကျေးဇူးတင်ပါတယ် ♥</button>
      </section>
    </div>
  );
}
