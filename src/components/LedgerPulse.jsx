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

function PlantColumn({ point, maxAmount, index }) {
  const series = [
    { key: "paidAmount", color: "from-emerald-300 to-emerald-500", leaf: "bg-emerald-400", label: "ငွေချေ" },
    { key: "debtAmount", color: "from-rose-300 to-rose-500", leaf: "bg-rose-400", label: "အကြွေးတိုး" },
    { key: "cashAmount", color: "from-sky-300 to-sky-500", leaf: "bg-sky-400", label: "လက်ငင်း" },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1" aria-label={`${point.date} data summary`}>
      <div className="flex h-48 w-full items-end justify-center gap-1 rounded-xl border border-slate-200 bg-white/80 px-1.5 pb-2 pt-3 shadow-inner sm:h-56 sm:gap-1.5">
        {series.map((item, seriesIndex) => {
          const amount = Number(point[item.key] || 0);
          const height = amount > 0 ? Math.max(10, Math.round((amount / maxAmount) * 100)) : 4;
          return (
            <div key={item.key} className="relative flex h-full w-1/4 max-w-7 items-end justify-center sm:max-w-9">
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
      <span className="text-[10px] font-semibold text-slate-600 sm:text-[11px]">{formatDay(point.date)}</span>
      <span className="text-[9px] text-slate-500">{point.activityCount || 0} လုပ်ဆောင်ချက်</span>
    </div>
  );
}

export default function LedgerPulse({ data, loading = false, error = "" }) {
  const points = useMemo(() => (Array.isArray(data?.days) ? data.days : []), [data?.days]);
  const maxAmount = useMemo(() => Math.max(
    1,
    ...points.flatMap((point) => [
      Number(point.paidAmount || 0),
      Number(point.debtAmount || 0),
      Number(point.cashAmount || 0),
    ]),
  ), [points]);

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-200 bg-gradient-to-br from-white via-cyan-50/50 to-slate-50 p-3 text-slate-800 shadow-lg shadow-cyan-100/60 sm:p-5" aria-labelledby="ledger-pulse-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-700/80">Ledger Pulse</p>
          <h2 id="ledger-pulse-title" className="mt-1 text-base font-bold text-slate-900 sm:text-lg">၇ ရက် စာရင်းအခြေအနေ</h2>
          <p className="mt-1 text-[11px] text-slate-600 sm:text-xs">ငွေချေ၊ အကြွေးတိုးနှင့် လက်ငင်းကို သီးခြားမြင်နိုင်ပါသည်။</p>
        </div>
        <div className="rounded-full border border-cyan-200 bg-white/80 px-3 py-1 text-[10px] font-semibold text-cyan-700">Data plant view</div>
      </div>

      {loading && points.length === 0 ? (
        <div className="mt-5 flex h-48 items-end justify-center gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 pb-5 shadow-inner sm:h-56" aria-live="polite">
          {[38, 58, 28, 72, 46, 64, 34].map((height, index) => (
            <span key={index} className="ledger-pulse-rise w-3 rounded-t-full bg-gradient-to-t from-cyan-400 to-cyan-100 opacity-80 shadow-[0_0_10px_rgba(14,165,233,0.2)]" style={{ height: `${height}%`, animationDelay: `${index * 90}ms` }} />
          ))}
        </div>
      ) : error && points.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-600">အချက်အလက်များကို အောက်ခံတွင် ပြန်လည်ရယူနေပါသည်။</div>
      ) : points.length > 0 ? (
        <>
          <div className="mt-5 grid grid-cols-7 gap-2 sm:gap-3">
            {points.map((point, index) => <PlantColumn key={point.date} point={point} maxAmount={maxAmount} index={index} />)}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-600">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />ငွေချေ</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />အကြွေးတိုး</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400" />လက်ငင်း</span>
            <span className="ml-auto text-slate-500">အပင်အမြင့် = ငွေပမာဏအချိုး</span>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-600">ပြီးခဲ့သော ၇ ရက်အတွင်း ပြရန် data မရှိသေးပါ။</div>
      )}
    </section>
  );
}
