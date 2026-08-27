"use client";

import { useEffect, useMemo, useState } from "react";
import { encodeActorHeader } from "@/lib/actor-header";

const money = new Intl.NumberFormat("en-US");

const EMPTY_DAY = {
  retailTotal: 0,
  wholesaleTotal: 0,
  dailyTotal: 0,
  retailCash: 0,
  wholesaleCash: 0,
  cashDailyTotal: 0,
  recordCount: 0,
};

const INPUT_FIELDS = [
  { key: "retailTotal", label: "လက်လီ (ငွေသား + KPay/Bank/Wave)", tone: "violet" },
  { key: "wholesaleTotal", label: "လက်ကား (ငွေသား + KPay/Bank/Wave)", tone: "amber" },
  { key: "retailCash", label: "လက်လီ (ငွေသား)", tone: "violet" },
  { key: "wholesaleCash", label: "လက်ကား (ငွေသား)", tone: "amber" },
];

function formatMoney(value) {
  return `${money.format(Math.round(Number(value || 0)))} Ks`;
}

function formatMyanmarDateInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

function toDraft(day) {
  return {
    retailTotal: Number(day?.retailTotal || 0),
    wholesaleTotal: Number(day?.wholesaleTotal || 0),
    retailCash: Number(day?.retailCash || 0),
    wholesaleCash: Number(day?.wholesaleCash || 0),
  };
}

function toneClasses(tone) {
  return tone === "violet"
    ? "border-violet-200 bg-violet-50 text-violet-900"
    : "border-amber-200 bg-amber-50 text-amber-900";
}

export default function DailySalesSummaryPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState(() => formatMyanmarDateInputValue());
  const [summary, setSummary] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    const actorName = window.localStorage.getItem("actorName") || "";
    setLoading(true);
    setError("");
    fetch(`/api/daily-sales-summary?date=${encodeURIComponent(date)}`, {
      cache: "no-store",
      headers: { "x-actor-name": encodeActorHeader(actorName) },
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.ok) throw new Error(body.error || "နေ့စဉ်ရောင်းရငွေ data မရသေးပါ။");
        return body.data;
      })
      .then((result) => {
        if (!active) return;
        setSummary(result);
        setDraft(toDraft(result.selectedDay));
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "နေ့စဉ်ရောင်းရငွေ data မရသေးပါ။");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [date, isOpen]);

  const automatic = summary?.selectedDay || EMPTY_DAY;
  const values = draft || toDraft(automatic);
  const dailyTotal = Number(values.retailTotal || 0) + Number(values.wholesaleTotal || 0);
  const automaticDailyTotal = Number(automatic.retailTotal || 0) + Number(automatic.wholesaleTotal || 0);
  const monthlyTotal = Number(summary?.monthlyTotal || 0) + dailyTotal - automaticDailyTotal;
  const cashDailyTotal = Number(values.retailCash || 0) + Number(values.wholesaleCash || 0);
  const hasManualDifference = dailyTotal !== automaticDailyTotal
    || Number(values.retailCash || 0) !== Number(automatic.retailCash || 0)
    || Number(values.wholesaleCash || 0) !== Number(automatic.wholesaleCash || 0);

  const currentLabel = useMemo(() => {
    if (!date) return "ရက်စွဲရွေးရန်";
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  }, [date]);

  const handleInput = (key, value) => {
    setDraft((current) => ({ ...(current || toDraft(automatic)), [key]: value === "" ? "" : Number(value) }));
  };

  const resetToAutomatic = () => setDraft(toDraft(automatic));

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-full min-h-[110px] min-w-0 w-full flex-col items-start justify-start rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md sm:min-h-[158px]"
        aria-label="နေ့စဉ် လက်လီ လက်ကား ရောင်းရငွေ panel ဖွင့်ရန်"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">နေ့စဉ်ရောင်းရငွေ</p>
        <p className="mt-2 text-lg font-bold text-indigo-900">လက်လီ / လက်ကား</p>
        <p className="mt-1 text-xs text-indigo-700">၄ ခုထည့်ပြီး auto တွက်ရန် →</p>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/35 p-2 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="daily-sales-summary-title">
          <section className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Auto Preview Panel</p>
                <h2 id="daily-sales-summary-title" className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">နေ့စဉ် လက်လီ / လက်ကား ရောင်းရငွေ</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">ရှိပြီးသား CashSale data ကို အရင်ဖြည့်ပြပြီး အောက်က ၄ ခုကို ပြင်လျှင် formula ကိုသာ စမ်းတွက်ပေးပါသည်။</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50" aria-label="Panel ပိတ်ရန်">ပိတ်မည်</button>
            </div>

            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
                <span>စာရင်းရက်</span>
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-800" />
              </label>
              <span className="text-xs font-semibold text-indigo-700">{currentLabel}{summary ? ` · CashSale ${summary.selectedDay?.recordCount || 0} ခု` : ""}</span>
            </div>

            {loading ? <p className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-center text-sm text-indigo-800">ရှိပြီးသား data ကို auto တွက်နေပါသည်...</p> : null}
            {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {INPUT_FIELDS.map((field) => (
                <label key={field.key} className={`rounded-xl border p-3 ${toneClasses(field.tone)}`}>
                  <span className="block text-xs font-semibold leading-5">{field.label}</span>
                  <span className="mt-2 flex items-center gap-2">
                    <input type="number" min="0" value={values[field.key]} onChange={(event) => handleInput(field.key, event.target.value)} className="min-h-11 w-full rounded-lg border border-white/80 bg-white px-3 py-2 text-base font-bold text-slate-900 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    <span className="text-xs font-semibold">Ks</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5">
                <p className="text-xs font-semibold text-rose-800">တစ်နေ့တာ လက်လီ + လက်ကား</p>
                <p className="mt-1 text-xl font-bold text-rose-900">{formatMoney(dailyTotal)}</p>
                <p className="mt-1 text-[11px] text-rose-700">Row ၁ ရဲ့ ခရမ်း + အဝါ</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                <p className="text-xs font-semibold text-emerald-800">တစ်လစာ ရောင်းရငွေ</p>
                <p className="mt-1 text-xl font-bold text-emerald-900">{formatMoney(monthlyTotal)}</p>
                <p className="mt-1 text-[11px] text-emerald-700">လဆန်း ၁ ရက်မှ {currentLabel} အထိ</p>
              </div>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-3.5"><p className="text-xs font-semibold text-violet-800">လက်လီ ငွေသား</p><p className="mt-1 text-lg font-bold text-violet-900">{formatMoney(values.retailCash)}</p></div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5"><p className="text-xs font-semibold text-amber-800">လက်ကား ငွေသား</p><p className="mt-1 text-lg font-bold text-amber-900">{formatMoney(values.wholesaleCash)}</p></div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5"><p className="text-xs font-semibold text-rose-800">တစ်နေ့တာ ငွေသား</p><p className="mt-1 text-lg font-bold text-rose-900">{formatMoney(cashDailyTotal)}</p></div>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs leading-5 text-slate-700 sm:flex-row sm:items-center sm:justify-between">
              <p>{hasManualDifference ? "လက်ရှိ input ကို formula စမ်းတွက်ထားပါသည်။ Database သို့ မသိမ်းသေးပါ။" : "အခုတန်ဖိုးများသည် ရှိပြီးသား CashSale data မှ auto တွက်ထားခြင်းဖြစ်ပါသည်။"}</p>
              <button type="button" onClick={resetToAutomatic} disabled={!summary} className="shrink-0 rounded-lg border border-indigo-200 bg-white px-3 py-2 font-semibold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50">Auto data ပြန်ထားရန်</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
