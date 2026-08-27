'use client';

import { useMemo } from "react";

const amountFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function formatMoney(value) {
  return `${amountFormatter.format(Math.round(Number(value || 0)))} Ks`;
}

function formatDay(date) {
  const [, month, day] = String(date || "").split("-");
  return month && day ? `${month}/${day}` : "-";
}

function displayValue(value) {
  const amount = Number(value || 0);
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
  return String(Math.round(amount));
}

function PlantColumn({ point, maxAmount, index }) {
  const series = [
    { key: "paidAmount", color: "from-emerald-400 to-emerald-600", leaf: "bg-emerald-300", label: "ငွေချေ" },
    { key: "debtAmount", color: "from-rose-400 to-rose-600", leaf: "bg-rose-300", label: "အကြွေးတိုး" },
    { key: "cashAmount", color: "from-cyan-400 to-cyan-600", leaf: "bg-cyan-300", label: "လက်ငင်း" },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1" aria-label={`${point.date} data summary`}>
      <div className="flex h-36 w-full items-end justify-center gap-1 rounded-xl border border-white/10 bg-slate-950/35 px-1.5 pb-2 pt-3 sm:h-40 sm:gap-1.5">
        {series.map((item, seriesIndex) => {
          const amount = Number(point[item.key] || 0);
          const height = amount > 0 ? Math.max(10, Math.round((amount / maxAmount) * 100)) : 4;
          return (
            <div key={item.key} className="relative flex h-full w-1/4 max-w-5 items-end justify-center">
              <div
                className={`ledger-pulse-rise relative w-full rounded-t-full bg-gradient-to-t ${item.color} shadow-[0_0_12px_rgba(34,211,238,0.18)]`}
                style={{ height: `${height}%`, animationDelay: `${index * 85 + seriesIndex * 55}ms` }}
                title={`${item.label}: ${formatMoney(amount)}`}
              >
                <span
                  className={`absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full ${item.leaf} shadow-[0_0_8px_currentColor]`}
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}
      </div>
      <span className="text-[10px] font-semibold text-cyan-100/80 sm:text-[11px]">{formatDay(point.date)}</span>
      <span className="text-[9px] text-slate-400">{point.activityCount || 0} လုပ်ဆောင်ချက်</span>
    </div>
  );
}

export default function LedgerPulse({ data, loading = false, error = "" }) {
  const points = Array.isArray(data?.days) ? data.days : [];
  const totals = data?.totals || {};
  const maxAmount = useMemo(() => Math.max(
    1,
    ...points.flatMap((point) => [
      Number(point.paidAmount || 0),
      Number(point.debtAmount || 0),
      Number(point.cashAmount || 0),
    ]),
  ), [points]);

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-3 text-white shadow-xl shadow-cyan-950/10 sm:p-5" aria-labelledby="ledger-pulse-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/80">Ledger Pulse</p>
          <h2 id="ledger-pulse-title" className="mt-1 text-base font-bold text-white sm:text-lg">၇ ရက် စာရင်းအခြေအနေ</h2>
          <p className="mt-1 text-[11px] text-slate-300 sm:text-xs">ငွေချေ၊ အကြွေးတိုးနှင့် လက်ငင်းကို သီးခြားမြင်နိုင်ပါသည်။</p>
        </div>
        <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-semibold text-cyan-100">Data plant view</div>
      </div>

      {loading && points.length === 0 ? (
        <div className="mt-4 flex h-40 items-end justify-center gap-3 rounded-xl border border-white/10 bg-slate-950/35 px-4 pb-5" aria-live="polite">
          {[38, 58, 28, 72, 46, 64, 34].map((height, index) => (
            <span key={index} className="ledger-pulse-rise w-3 rounded-t-full bg-gradient-to-t from-cyan-700 to-cyan-300 opacity-70" style={{ height: `${height}%`, animationDelay: `${index * 90}ms` }} />
          ))}
        </div>
      ) : error && points.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 p-4 text-xs text-slate-300">အချက်အလက်များကို အောက်ခံတွင် ပြန်လည်ရယူနေပါသည်။</div>
      ) : points.length > 0 ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2">
              <p className="text-[10px] text-emerald-200/80">ငွေချေ</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-100">{formatMoney(totals.paidAmount)}</p>
              <p className="text-[10px] text-emerald-200/70">{totals.paidCount || 0} ခု</p>
            </div>
            <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2">
              <p className="text-[10px] text-rose-200/80">အကြွေးတိုး</p>
              <p className="mt-0.5 text-sm font-bold text-rose-100">{formatMoney(totals.debtAmount)}</p>
              <p className="text-[10px] text-rose-200/70">{totals.debtCount || 0} ခု</p>
            </div>
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2">
              <p className="text-[10px] text-cyan-100/80">လက်ငင်း</p>
              <p className="mt-0.5 text-sm font-bold text-cyan-50">{formatMoney(totals.cashAmount)}</p>
              <p className="text-[10px] text-cyan-100/70">{totals.cashCount || 0} ခု</p>
            </div>
            <div className="rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 py-2">
              <p className="text-[10px] text-violet-100/80">လုပ်ဆောင်ချက်</p>
              <p className="mt-0.5 text-sm font-bold text-violet-50">{totals.activityCount || 0} ခု</p>
              <p className="text-[10px] text-violet-100/70">စာရင်းစစ်မှတ်တမ်း</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
            {points.map((point, index) => <PlantColumn key={point.date} point={point} maxAmount={maxAmount} index={index} />)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-300">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />ငွေချေ</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />အကြွေးတိုး</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-400" />လက်ငင်း</span>
            <span className="ml-auto text-slate-400">အပင်အမြင့် = ငွေပမာဏအချိုး</span>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 p-4 text-xs text-slate-300">ပြီးခဲ့သော ၇ ရက်အတွင်း ပြရန် data မရှိသေးပါ။</div>
      )}
    </section>
  );
}
