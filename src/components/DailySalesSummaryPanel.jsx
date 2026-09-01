"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  source: "NONE",
};

const INPUT_FIELDS = [
  { key: "retailTotal", label: "လက်လီ (ငွေသား + KPay/Bank/Wave)", tone: "violet" },
  { key: "wholesaleTotal", label: "လက်ကား (ငွေသား + KPay/Bank/Wave)", tone: "amber" },
  { key: "retailCash", label: "လက်လီ (ငွေသား)", tone: "violet" },
  { key: "wholesaleCash", label: "လက်ကား (ငွေသား)", tone: "amber" },
];

const AUGUST_NOTEBOOK_OPENING = {
  month: "2026-08",
  amount: "246593950",
  asOfDate: "2026-08-26",
  note: "စာအုပ်မှ 26/08/2026 အထိ",
};

function formatMoney(value) {
  return `${money.format(Math.round(Number(value || 0)))} Ks`;
}

function calculationModeLabel(row) {
  if (row?.source === "CASH_SALE") return "CashSale auto";
  if (row?.calculationMode === "AUTO") return "Auto";
  if (row?.calculationMode === "MANUAL") return "Manual";
  if (row?.calculationMode === "AUTO_ADJUSTED") return "Auto + ညှိ";
  return "Legacy";
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

function getPreviousMyanmarDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  const local = new Date(date.getTime() + (6 * 60 + 30) * 60 * 1000);
  const previous = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - 1));
  return formatMyanmarDateInputValue(new Date(previous.getTime() - (6 * 60 + 30) * 60 * 1000));
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
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [showOpeningForm, setShowOpeningForm] = useState(false);
  const [openingDraft, setOpeningForm] = useState({ amount: "", asOfDate: "", note: "" });

  const load = useCallback(async (targetDate = date) => {
    let active = true;
    const actorName = window.localStorage.getItem("actorName") || "";
    setLoading(true);
    setError("");
    setSaveNotice("");
    try {
      const response = await fetch(`/api/daily-sales-summary?date=${encodeURIComponent(targetDate)}`, {
        cache: "no-store",
        headers: { "x-actor-name": encodeActorHeader(actorName) },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "နေ့စဉ်ရောင်းရငွေ data မရသေးပါ။");
      if (active) {
        setSummary(body.data);
        setDraft(toDraft(body.data.autoPreview || body.data.selectedDay));
        setIsEditing(false);
        if (body.data.opening?.updatedAt) {
          setOpeningForm({ amount: body.data.opening.amount, asOfDate: body.data.opening.asOfDate, note: body.data.opening.note });
        } else if (targetDate.startsWith(AUGUST_NOTEBOOK_OPENING.month) && targetDate >= AUGUST_NOTEBOOK_OPENING.asOfDate) {
          setOpeningForm({ ...AUGUST_NOTEBOOK_OPENING });
          setShowOpeningForm(true);
        } else {
          setOpeningForm({ amount: "", asOfDate: getPreviousMyanmarDateInputValue(targetDate), note: "စာအုပ်မှ စုစုပေါင်း" });
        }
      }
    } catch (requestError) {
      if (active) setError(requestError.message || "နေ့စဉ်ရောင်းရငွေ data မရသေးပါ။");
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, [date]);

  useEffect(() => {
    if (!isOpen) return;
    setIsEditing(false);
    load();
  }, [isOpen, load]);

  const automatic = summary?.autoPreview || summary?.selectedDay || EMPTY_DAY;
  const values = draft || toDraft(automatic);
  const dailyTotal = Number(values.retailTotal || 0) + Number(values.wholesaleTotal || 0);
  const automaticDailyTotal = Number(automatic.retailTotal || 0) + Number(automatic.wholesaleTotal || 0);
  const monthlyDelta = !summary?.opening?.asOfDate || date > summary.opening.asOfDate
    ? dailyTotal - automaticDailyTotal
    : 0;
  const monthlyTotal = Number(summary?.monthlyTotal || 0) + monthlyDelta;
  const cashDailyTotal = Number(values.retailCash || 0) + Number(values.wholesaleCash || 0);
  const hasManualDifference = Number(values.retailTotal || 0) !== Number(automatic.retailTotal || 0)
    || Number(values.wholesaleTotal || 0) !== Number(automatic.wholesaleTotal || 0)
    || Number(values.retailCash || 0) !== Number(automatic.retailCash || 0)
    || Number(values.wholesaleCash || 0) !== Number(automatic.wholesaleCash || 0);
  const invalidCashInput = Number(values.retailCash || 0) > Number(values.retailTotal || 0)
    || Number(values.wholesaleCash || 0) > Number(values.wholesaleTotal || 0);
  const tableRows = useMemo(() => {
    if (!summary?.rows?.length) return [];
    let running = Number(summary.opening?.amount || 0);
    const openingAsOfDate = summary.opening?.asOfDate || "";
    return summary.rows.map((row) => {
      const displayRow = row.date === date
        ? {
            ...row,
            retailTotal: Number(values.retailTotal || 0),
            wholesaleTotal: Number(values.wholesaleTotal || 0),
            dailyTotal,
            retailCash: Number(values.retailCash || 0),
            wholesaleCash: Number(values.wholesaleCash || 0),
            cashDailyTotal,
          }
        : row;
      const included = !openingAsOfDate || displayRow.date > openingAsOfDate;
      if (included) running += displayRow.dailyTotal;
      return { ...displayRow, monthlyCumulative: included ? running : null };
    });
  }, [summary, date, values, dailyTotal, cashDailyTotal]);

  const currentLabel = useMemo(() => {
    if (!date) return "ရက်စွဲရွေးရန်";
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  }, [date]);

  const handleInput = (key, value) => {
    setIsEditing(true);
    setSaveNotice("");
    setDraft((current) => ({ ...(current || toDraft(automatic)), [key]: value === "" ? "" : Number(value) }));
  };

  const resetToAutomatic = () => {
    setIsEditing(false);
    setDraft(toDraft(automatic));
  };

  const saveDaily = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    setSaveNotice("");
    const actorName = window.localStorage.getItem("actorName") || "";
    try {
      const response = await fetch("/api/daily-sales-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-actor-name": encodeActorHeader(actorName) },
        body: JSON.stringify({
          date,
          ...values,
          calculationMode: hasManualDifference ? "MANUAL" : "AUTO",
          adjustmentReason: hasManualDifference ? "Daily Summary တန်ဖိုးကို user က ညှိထားသည်" : null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "သိမ်းဆည်း၍ မရပါ။");
      setSummary(body.data);
      setDraft(toDraft(body.data.selectedDay));
      setIsEditing(false);
      setSaveNotice("နေ့စဉ်စာရင်း သိမ်းပြီးပါပြီ။");
    } catch (saveError) {
      setIsEditing(true);
      setError(saveError.message || "နေ့စဉ်စာရင်း သိမ်း၍ မရပါ။ ပြန်စမ်းပါ။");
    } finally {
      setSaving(false);
    }
  }, [date, saving, values]);

  const saveOpening = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    setSaveNotice("");
    const actorName = window.localStorage.getItem("actorName") || "";
    try {
      const response = await fetch("/api/daily-sales-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-actor-name": encodeActorHeader(actorName) },
        body: JSON.stringify({ action: "opening", month: date.slice(0, 7), selectedDate: date, ...openingDraft }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "Opening သိမ်း၍ မရပါ။");
      setSummary(body.data);
      setShowOpeningForm(false);
      setSaveNotice("စာအုပ်အစ စုစုပေါင်း သိမ်းပြီးပါပြီ။");
    } catch (saveError) {
      setError(saveError.message || "Opening သိမ်း၍ မရပါ။ ပြန်စမ်းပါ။");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="neon-card neon-sweep neon-card-indigo flex h-full min-h-[110px] min-w-0 w-full flex-col items-start justify-start rounded-xl border border-indigo-200 bg-indigo-50/85 p-4 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md sm:min-h-[158px]"
        aria-label="နေ့စဉ် လက်လီ လက်ကား ရောင်းရငွေ panel ဖွင့်ရန်"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">နေ့စဉ်ရောင်းရငွေ</p>
        <p className="mt-2 text-lg font-bold text-indigo-900">လက်လီ / လက်ကား</p>
        <p className="mt-1 text-xs text-indigo-700">နေ့စဉ်သိမ်းပြီး ဇယားကြည့်ရန် →</p>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/35 p-2 backdrop-blur-[2px] sm:items-center sm:p-5" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }} role="dialog" aria-modal="true" aria-labelledby="daily-sales-summary-title">
          <section className="relative max-h-[calc(100dvh-1rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-indigo-200 bg-white p-3 shadow-2xl sm:max-h-[94vh] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Daily Sales Summary</p>
                <h2 id="daily-sales-summary-title" className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">နေ့စဉ် လက်လီ / လက်ကား ရောင်းရငွေ</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">နေ့စဉ် ၄ ခုကို သိမ်းထားနိုင်ပြီး တစ်လစာစုစုပေါင်းကို auto တွက်ပေးပါသည်။</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50" aria-label="Panel ပိတ်ရန်">ပိတ်မည်</button>
            </div>

            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
                <span>စာရင်းရက်</span>
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-800" />
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-indigo-700">{currentLabel}{summary ? " · Auto Preview (မသိမ်းရသေး)" : ""}</span>
                <button type="button" onClick={() => setShowOpeningForm(!showOpeningForm)} className="text-xs font-bold text-indigo-600 underline">Opening ညှိရန်</button>
              </div>
            </div>

            {showOpeningForm && (
              <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
                <h3 className="text-sm font-bold text-indigo-900">လအစ စာအုပ်လက်ကျန် ညှိရန်</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-[11px] font-bold text-indigo-700">စုစုပေါင်း (Ks)</span>
                    <input type="number" value={openingDraft.amount} onChange={(e) => setOpeningForm({ ...openingDraft, amount: e.target.value })} className="h-10 w-full rounded-lg border border-indigo-200 px-3 text-sm font-bold" placeholder="0" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-bold text-indigo-700">ဘယ်ရက်အထိ (As of)</span>
                    <input type="date" value={openingDraft.asOfDate} onChange={(e) => setOpeningForm({ ...openingDraft, asOfDate: e.target.value })} className="h-10 w-full rounded-lg border border-indigo-200 px-3 text-sm" />
                  </label>
                  <div className="flex items-end">
                    <button type="button" onClick={saveOpening} disabled={saving} className="h-10 w-full rounded-lg bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? "သိမ်းနေသည်..." : "Opening သိမ်းမည်"}</button>
                  </div>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-indigo-600">26/08/2026 အထိ စာအုပ်ထဲက စုစုပေါင်း <strong>246,593,950 Ks</strong> ကို အကြိုဖြည့်ထားပါသည်။ မသိမ်းမီ ပြန်စစ်နိုင်ပြီး `Opening သိမ်းမည်` နှိပ်မှသာ database ထဲ သိမ်းပါမည်။</p>
              </div>
            )}

            {loading ? <p className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-center text-sm text-indigo-800">Data ရယူနေပါသည်...</p> : null}
            {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
            {saveNotice ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{saveNotice}</p> : null}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 sm:items-stretch">
              {[INPUT_FIELDS[0], INPUT_FIELDS[2], INPUT_FIELDS[1], INPUT_FIELDS[3]].map((field) => (
                <label key={field.key} className={`flex h-full flex-col rounded-xl border p-3 ${toneClasses(field.tone)}`}>
                  <span className="block text-xs font-semibold leading-5">{field.label}</span>
                  <span className="mt-2 flex items-center gap-2">
                    <input type="number" min="0" value={values[field.key]} onChange={(event) => handleInput(field.key, event.target.value)} className="min-h-11 w-full rounded-lg border border-white/80 bg-white px-3 py-2 text-base font-bold text-slate-900 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    <span className="text-xs font-semibold">Ks</span>
                  </span>
                </label>
              ))}
              <div className="flex h-full flex-col rounded-xl border border-rose-200 bg-rose-50 p-3.5">
                <p className="text-xs font-semibold text-rose-800">တစ်နေ့တာ လက်လီ + လက်ကား</p>
                <p className="mt-1 text-xl font-bold text-rose-900">{formatMoney(dailyTotal)}</p>
                <p className="mt-1 text-[11px] text-rose-700">Row ၁ ရဲ့ ခရမ်း + အဝါ</p>
              </div>
              <div className="flex h-full flex-col rounded-xl border border-rose-200 bg-rose-50 p-3.5">
                <p className="text-xs font-semibold text-rose-800">တစ်နေ့တာ ငွေသား</p>
                <p className="mt-1 text-lg font-bold text-rose-900">{formatMoney(cashDailyTotal)}</p>
                <p className="mt-1 text-[11px] text-rose-700">လက်လီငွေသား + လက်ကားငွေသား</p>
              </div>
              <div className="col-span-2 flex h-full w-full flex-col justify-self-center rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 sm:w-1/2">
                <p className="text-xs font-semibold text-emerald-800">လစဉ်စုစုပေါင်း / နောက်နေ့ Opening</p>
                <p className="mt-1 text-xl font-bold text-emerald-900">{formatMoney(monthlyTotal)}</p>
                <p className="mt-1 text-[11px] text-emerald-700">ဒီနေ့စာရင်းသိမ်းပြီးနောက် နောက်နေ့ Opening အဖြစ် ဆက်သွားမည်</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs leading-5 text-slate-700 sm:flex-row sm:items-center sm:justify-between">
              <p>{saving ? "နေ့စဉ်စာရင်းကို သိမ်းနေပါသည်..." : hasManualDifference ? "Preview တန်ဖိုးကို ပြင်ထားပါသည်။ Live row ကို မပြင်သေးပါ။" : "အခုတန်ဖိုးများသည် ရှိပြီးသား CashSale/Ledger data မှ auto preview တွက်ထားခြင်းဖြစ်ပါသည်။"}</p>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                <button type="button" onClick={resetToAutomatic} disabled={!summary || saving} className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 font-semibold text-indigo-800 hover:bg-indigo-50 disabled:opacity-50 sm:w-auto">Auto data ပြန်ထားရန်</button>
                <button type="button" onClick={saveDaily} disabled={saving || invalidCashInput} className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 sm:w-auto">{saving ? "သိမ်းနေသည်..." : "နေ့စဉ်စာရင်း သိမ်းမည်"}</button>
              </div>
            </div>

            {summary?.rows?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-slate-900">နေ့စဉ်ရောင်းရငွေ / နောက်နေ့ Opening ဇယား</h3>
                <p className="mt-1 text-[11px] text-slate-500">အဲဒီနေ့အဆုံး စုစုပေါင်းက နောက်နေ့ Opening အဖြစ် အလိုအလျောက် ဆက်သွားပါသည်။</p>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-bold">ရက်စွဲ</th>
                        <th className="px-3 py-2 font-bold">လက်လီ (Total)</th>
                        <th className="px-3 py-2 font-bold">လက်ကား (Total)</th>
                        <th className="px-3 py-2 font-bold">တစ်နေ့တာ</th>
                        <th className="px-3 py-2 font-bold">အဲဒီနေ့အဆုံး / နောက်နေ့ Opening</th>
                        <th className="px-3 py-2 font-bold">ငွေသား</th>
                        <th className="px-3 py-2 font-bold">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tableRows.map((row) => (
                        <tr key={row.date} className={row.date === date ? "bg-indigo-50/50" : ""}>
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">{row.date.slice(8, 10)}/{row.date.slice(5, 7)}</td>
                          <td className="px-3 py-2 text-slate-700">{formatMoney(row.retailTotal)}</td>
                          <td className="px-3 py-2 text-slate-700">{formatMoney(row.wholesaleTotal)}</td>
                          <td className="px-3 py-2 font-bold text-indigo-900">{formatMoney(row.dailyTotal)}</td>
                          <td className="px-3 py-2 font-bold text-emerald-900">{row.monthlyCumulative == null ? "—" : formatMoney(row.monthlyCumulative)}</td>
                          <td className="px-3 py-2 text-slate-700">{formatMoney(row.cashDailyTotal)}</td>
                          <td className="px-3 py-2 text-[10px] font-medium text-slate-500">{row.source === "DAILY_SUMMARY" ? `Saved · ${calculationModeLabel(row)}` : calculationModeLabel(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
