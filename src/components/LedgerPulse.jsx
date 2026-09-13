'use client';

import { useMemo, useState } from "react";

const amountFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function formatMoney(value) {
  return `${amountFormatter.format(Math.round(Number(value || 0)))} Ks`;
}

function formatDay(date) {
  const [, month, day] = String(date || "").split("-");
  return month && day ? `${month}/${day}` : "-";
}

function PlantColumn({ point, maxOutput, index }) {
  const series = [
    { key: "paidAmount", color: "from-emerald-300 to-emerald-500", leaf: "bg-emerald-400", label: "ငွေချေ", unit: "financial" },
    { key: "debtAmount", color: "from-rose-300 to-rose-500", leaf: "bg-rose-400", label: "အကြွေးတိုး", unit: "financial" },
    { key: "cashAmount", color: "from-sky-300 to-sky-500", leaf: "bg-sky-400", label: "လက်ငင်း", unit: "financial" },
    { key: "bottleOutput", color: "from-amber-300 to-amber-500", leaf: "bg-amber-400", label: "ဗူးထွက်ရှိမှု", unit: "bottles" },
    { key: "tubeOutput", color: "from-violet-300 to-violet-500", leaf: "bg-violet-400", label: "Tube ထွက်ရှိမှု", unit: "tubes" },
  ];
  const financialTotal = [point.paidAmount, point.debtAmount, point.cashAmount].reduce((sum, value) => sum + Number(value || 0), 0);

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border border-amber-200/90 bg-gradient-to-b from-amber-50/80 via-white/70 to-white/90 p-1 shadow-[0_0_10px_rgba(245,158,11,0.22)]" aria-label={`${point.date} data summary`}>
      <div className="flex h-40 w-full items-end justify-center gap-0.5 rounded-lg border border-amber-100 bg-white/80 px-1 pb-2 pt-3 shadow-inner sm:h-48 sm:gap-1">
        {series.map((item, seriesIndex) => {
          const amount = Number(point[item.key] || 0);
          const percentage = item.unit === "financial"
            ? (financialTotal > 0 ? (amount / financialTotal) * 100 : 0)
            : (maxOutput > 0 ? (amount / maxOutput) * 100 : 0);
          const height = amount > 0 ? Math.min(92, Math.max(8, Math.round(percentage * 0.92))) : 3;
          return (
              <div key={item.key} className="relative flex h-full w-1/6 max-w-7 items-end justify-center sm:max-w-9">
              <span className="absolute bottom-[calc(var(--bar-height)+0.2rem)] text-[8px] font-black text-slate-600" style={{ "--bar-height": `${height}%` }}>{amount > 0 ? `${Math.round(percentage)}%` : ""}</span>
              <div
                className={`ledger-pulse-rise relative w-full rounded-t-full bg-gradient-to-t ${item.color} shadow-[0_0_12px_rgba(34,211,238,0.18)]`}
                style={{ height: `${height}%`, animationDelay: `${index * 85 + seriesIndex * 55}ms` }}
                title={`${item.label}: ${item.unit === "financial" ? `${formatMoney(amount)} · ${percentage.toFixed(1)}% of daily financial total` : `${amount.toLocaleString()} ဗူး · ${percentage.toFixed(1)}% of 7-day output peak`}`}
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
  const [isExpanded, setIsExpanded] = useState(false);
  const points = useMemo(() => (Array.isArray(data?.days) ? data.days : []), [data?.days]);
  const maxOutput = useMemo(() => Math.max(1, ...points.flatMap((point) => [Number(point.bottleOutput || 0), Number(point.tubeOutput || 0)])), [points]);

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-200 bg-gradient-to-br from-white via-cyan-50/50 to-slate-50 p-2.5 text-slate-800 shadow-lg shadow-cyan-100/60 sm:p-4" aria-labelledby="ledger-pulse-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-700/80">Ledger Pulse</p>
          <h2 id="ledger-pulse-title" className="mt-1 text-base font-bold text-slate-900 sm:text-lg">၇ ရက် စာရင်းအခြေအနေ</h2>
          <p className="mt-1 text-[11px] text-slate-600 sm:text-xs">Graph ကို လိုအပ်သည့်အချိန်တွင်သာ ဖွင့်ကြည့်နိုင်ပါသည်။</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full border border-cyan-200 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50 active:scale-[0.98]"
          onClick={() => setIsExpanded((value) => !value)}
          aria-expanded={isExpanded}
          aria-controls="ledger-pulse-graph"
        >
          {isExpanded ? "Graph ဖျောက်ရန်" : "Graph ကြည့်ရန်"}
        </button>
      </div>

      {isExpanded && <div id="ledger-pulse-graph">
      {loading && points.length === 0 ? (
        <div className="mt-4 flex h-40 items-end justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 pb-4 shadow-inner sm:h-48" aria-live="polite">
          {[38, 58, 28, 72, 46, 64, 34].map((height, index) => (
            <span key={index} className="ledger-pulse-rise w-3 rounded-t-full bg-gradient-to-t from-cyan-400 to-cyan-100 opacity-80 shadow-[0_0_10px_rgba(14,165,233,0.2)]" style={{ height: `${height}%`, animationDelay: `${index * 90}ms` }} />
          ))}
        </div>
      ) : error && points.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-600">အချက်အလက်များကို အောက်ခံတွင် ပြန်လည်ရယူနေပါသည်။</div>
      ) : points.length > 0 ? (
        <>
          <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">
            {points.map((point, index) => <PlantColumn key={point.date} point={point} maxOutput={maxOutput} index={index} />)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-slate-600 sm:gap-x-3 sm:text-[10px]">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />ငွေချေ</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />အကြွေးတိုး</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400" />လက်ငင်း</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />ဗူးထွက်ရှိမှု</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-400" />Tube ထွက်ရှိမှု</span>
            <span className="ml-auto text-slate-500">ငွေ ၃ မျိုး = တစ်နေ့တာငွေစုစုပေါင်းအပေါ် % · ဗူး / Tube ထွက် = ၇ ရက်အတွင်း သက်ဆိုင်ရာအမြင့်ဆုံးအပေါ် %</span>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-600">ပြီးခဲ့သော ၇ ရက်အတွင်း ပြရန် data မရှိသေးပါ။</div>
      )}
      </div>}
    </section>
  );
}
