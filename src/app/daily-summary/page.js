"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMyanmarDateLabel } from "@/lib/myanmar-time-client";
import { encodeActorHeader } from "@/lib/actor-header";

const money = new Intl.NumberFormat("en-US");

function formatMyanmarDateInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

const today = formatMyanmarDateInputValue(new Date());

function formatMoney(value) {
  return `${money.format(Number(value || 0))} Ks`;
}

function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00+06:30`);
  return !Number.isNaN(date.getTime());
}

function safeMyanmarDateLabel(value) {
  return isValidDateInput(value) ? formatMyanmarDateLabel(`${value}T00:00:00+06:30`) : "ရက်စွဲ မရွေးရသေးပါ";
}

function cleanAiText(value) {
  return String(value || "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

async function fetchJson(path) {
  const actorName = localStorage.getItem("actorName") || "";
  const response = await fetch(path, { headers: { "x-actor-name": encodeActorHeader(actorName) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body.data;
}

function AiListItem({ item, index, tone }) {
  const palette = tone === "amber"
    ? "border-amber-200 bg-amber-50/70 text-amber-950"
    : "border-emerald-200 bg-emerald-50/70 text-slate-700";
  const badge = tone === "amber"
    ? "bg-amber-200 text-amber-900"
    : "bg-emerald-200 text-emerald-900";
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-2.5 ${palette}`}>
      <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`}>{index + 1}</span>
      <p className="min-w-0 text-[13px] leading-5 sm:text-sm sm:leading-6">{cleanAiText(item)}</p>
    </div>
  );
}

function AiDetailSection({ number, title, items, tone }) {
  const isAmber = tone === "amber";
  return (
    <details className={`group overflow-hidden rounded-xl border bg-white ${isAmber ? "border-amber-200" : "border-emerald-200"}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isAmber ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{number}</span>
          <span className="truncate text-sm font-bold text-slate-900 sm:text-base">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[11px] font-semibold text-slate-500 sm:text-xs">
          {items.length} ချက် <span aria-hidden="true" className="text-base leading-none transition-transform group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <div className={`border-t p-3 sm:p-4 ${isAmber ? "border-amber-100" : "border-emerald-100"}`}>
        {items.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">{items.map((item, index) => <AiListItem key={`${tone}-${index}`} item={item} index={index} tone={tone} />)}</div>
        ) : <p className="text-[13px] text-slate-500 sm:text-sm">မရှိပါ။</p>}
      </div>
    </details>
  );
}

function AiExplanationPanel({ explanation, date }) {
  const findings = Array.isArray(explanation?.findings) ? explanation.findings : [];
  const checks = Array.isArray(explanation?.checks) ? explanation.checks : [];
  return (
    <section className="rounded-2xl border border-violet-200 bg-white p-3 shadow-sm sm:p-5" aria-labelledby="ai-summary-title">
      <div className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-3 text-white sm:px-4 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-[11px] font-bold">AI</span>
              <h2 id="ai-summary-title" className="text-base font-bold sm:text-lg">AI ရှင်းပြချက်</h2>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-violet-100 sm:text-xs">နေ့စဉ်စာရင်းနှင့် လုပ်ဆောင်ချက်မှတ်တမ်းကို အကျဉ်းချုပ်ဖတ်ရှုထားခြင်း</p>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-violet-50">{date}</span>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">01</span>
          <h3 className="text-sm font-bold text-slate-900 sm:text-base">အနှစ်ချုပ်</h3>
        </div>
        <p className="mt-2 text-[13px] leading-6 text-slate-700 sm:text-sm sm:leading-7">{cleanAiText(explanation?.overview) || "အနှစ်ချုပ် မရရှိပါ။"}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-emerald-800">အဓိကတွေ့ရှိချက်</p>
          <p className="mt-0.5 text-lg font-bold text-emerald-900">{findings.length} <span className="text-[11px] font-medium">ချက်</span></p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-amber-800">ပြန်စစ်ရန်</p>
          <p className="mt-0.5 text-lg font-bold text-amber-900">{checks.length} <span className="text-[11px] font-medium">ချက်</span></p>
        </div>
      </div>

      {findings.length > 0 && <div className="mt-3"><AiDetailSection number="02" title="အဓိကတွေ့ရှိချက်များ" items={findings} tone="emerald" /></div>}
      {checks.length > 0 && <div className="mt-2"><AiDetailSection number="03" title="ပြန်စစ်သင့်သည့်အချက်များ" items={checks} tone="amber" /></div>}

      <div className="mt-3 flex items-start gap-2 rounded-xl border-l-4 border-slate-400 bg-slate-50 px-3 py-3 sm:px-4">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">!</span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">သတိပြုရန်</h3>
          <p className="mt-1 text-[13px] leading-5 text-slate-600 sm:text-sm sm:leading-6">{cleanAiText(explanation?.caution) || "အရေးကြီးသည့် စာရင်းများကို Website ထဲတွင် ပြန်စစ်ပါ။"}</p>
        </div>
      </div>
    </section>
  );
}

export default function DailySummaryPage() {
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchJson(`/api/daily-summary?date=${date}`)
      .then((result) => {
        if (!active) return;
        setError("");
        setData(result);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [date]);

  const paymentEntries = useMemo(() => Object.entries(data?.summary?.paymentTypes || {}), [data]);

  useEffect(() => {
    setAiExplanation(null);
    setAiError("");
  }, [date]);

  const handleAiExplain = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError("");
    try {
      const actorName = localStorage.getItem("actorName") || "";
      const response = await fetch(`/api/ai/daily-summary?date=${encodeURIComponent(date)}`, {
        headers: { "x-actor-name": encodeActorHeader(actorName) },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "AI ရှင်းပြချက် ရယူ၍ မရပါ။");
      setAiExplanation(body.data?.explanation || null);
    } catch (err) {
      setAiError(err.message || "AI ရှင်းပြချက် ရယူ၍ မရပါ။");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-3 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <a href="/" className="text-xs font-semibold text-cyan-700 sm:text-sm">← Dashboard</a>
              <h1 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">Daily Summary</h1>
              <p className="mt-1 text-[13px] leading-5 text-slate-600 sm:text-sm">ရွေးထားသောနေ့၏ ငွေချေမှုနှင့် အကြွေးတိုးမှု အသေးစိတ်</p>
              <p className="mt-2 text-[11px] font-semibold text-cyan-700 sm:text-xs">Report Date: {safeMyanmarDateLabel(date)}</p>
              <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">Time Range: 00:00–23:59 (Myanmar Time)</p>
            </div>
            <div className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:w-auto sm:min-w-56 sm:items-end">
              <input type="date" value={date} onChange={(e) => { const nextDate = e.target.value; if (isValidDateInput(nextDate)) setDate(nextDate); }} className="daily-summary-date-input block box-border min-h-11 min-w-0 w-full max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 sm:w-auto sm:text-sm" />
              <button type="button" onClick={handleAiExplain} disabled={loading || aiLoading} className="min-h-11 w-full rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:bg-slate-400 sm:w-auto sm:text-sm">
                {aiLoading ? "AI ရှင်းပြနေသည်..." : "AI ဖြင့် ရှင်းပြရန်"}
              </button>
            </div>
          </div>
        </header>

        {aiError && <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 sm:p-4"><h2 className="text-sm font-semibold text-rose-900 sm:text-base">AI ရှင်းပြချက် အမှား</h2><p className="mt-1 text-[13px] leading-5 text-rose-800 sm:mt-2 sm:text-sm">{aiError}</p></section>}
        {aiExplanation && <AiExplanationPanel explanation={aiExplanation} date={date} />}

        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-[13px] text-rose-700 sm:p-4 sm:text-sm">{error}</p>}
        {loading ? <div className="rounded-xl bg-white p-6 text-center text-[13px] text-slate-600 shadow-sm sm:p-8 sm:text-sm">Summary ရယူနေသည်...</div> : data && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
              <p className="text-[13px] font-semibold text-slate-700 sm:text-sm">စာရင်းရက်စွဲအလိုက် ငွေချေ/အကြွေးတိုး</p>
            </div>
            <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 sm:p-5"><p className="text-[13px] leading-5 text-emerald-700 sm:text-sm">ငွေချေသူ</p><p className="mt-1 text-[26px] font-bold leading-8 text-emerald-800 sm:mt-2 sm:text-3xl">{data.summary.paidCount}</p><p className="mt-1 text-[13px] text-emerald-700 sm:text-sm">{formatMoney(data.summary.paidAmount)}</p></div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 sm:p-5"><p className="text-[13px] leading-5 text-rose-700 sm:text-sm">အကြွေးတိုးသူ</p><p className="mt-1 text-[26px] font-bold leading-8 text-rose-800 sm:mt-2 sm:text-3xl">{data.summary.unpaidCount}</p><p className="mt-1 text-[13px] text-rose-700 sm:text-sm">{formatMoney(data.summary.unpaidAmount)}</p></div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 sm:p-5"><p className="text-[13px] leading-5 text-blue-700 sm:text-sm">Transaction စုစုပေါင်း</p><p className="mt-1 text-[26px] font-bold leading-8 text-blue-800 sm:mt-2 sm:text-3xl">{data.summary.totalTransactions}</p></div>
              <a href={`/activity?date=${date}`} className="rounded-xl border border-violet-200 bg-violet-50 p-3.5 shadow-sm transition hover:border-violet-300 hover:bg-violet-100 sm:p-5"><p className="text-[13px] leading-5 text-violet-700 sm:text-sm">ရွေးထားသောနေ့ လုပ်ဆောင်ချက်</p><p className="mt-1 text-[26px] font-bold leading-8 text-violet-800 sm:mt-2 sm:text-3xl">{data.summary.activityCount ?? data.summary.auditCount}</p><p className="mt-1 text-[11px] text-violet-700 sm:text-xs">အသေးစိတ်ကြည့်ရန် →</p></a>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5 lg:col-span-2">
                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Customer အလိုက် စာရင်းချုပ်</h2>
                <div className="mt-3 hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2.5">Customer</th><th className="px-3 py-2.5 text-right">ငွေချေ</th><th className="px-3 py-2.5 text-right">အကြွေးတိုး</th></tr></thead><tbody className="divide-y divide-slate-100">{data.customers.length ? data.customers.map((customer) => <tr key={customer.customerId}><td className="px-3 py-3 font-medium text-slate-800">{customer.customerName}</td><td className="px-3 py-3 text-right text-emerald-700">{customer.paidCount} / {formatMoney(customer.paidAmount)}</td><td className="px-3 py-3 text-right text-rose-700">{customer.unpaidCount} / {formatMoney(customer.unpaidAmount)}</td></tr>) : <tr><td colSpan="3" className="px-3 py-8 text-center text-slate-500">ဒီနေ့စာရင်းမရှိသေးပါ။</td></tr>}</tbody></table></div>
                <div className="mt-3 space-y-2 sm:hidden">{data.customers.length ? data.customers.map((customer) => <article key={customer.customerId} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="truncate text-sm font-semibold text-slate-900">{customer.customerName}</p><div className="mt-2 grid grid-cols-2 gap-2 text-[12px]"><div className="rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-800"><span className="block text-[11px] text-emerald-700">ငွေချေ</span><strong>{customer.paidCount} / {formatMoney(customer.paidAmount)}</strong></div><div className="rounded-md bg-rose-50 px-2 py-1.5 text-rose-800"><span className="block text-[11px] text-rose-700">အကြွေးတိုး</span><strong>{customer.unpaidCount} / {formatMoney(customer.unpaidAmount)}</strong></div></div></article>) : <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-[13px] text-slate-500">ဒီနေ့စာရင်းမရှိသေးပါ။</p>}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5"><h2 className="text-base font-semibold text-slate-900 sm:text-lg">Payment Type</h2><div className="mt-3 space-y-2">{paymentEntries.length ? paymentEntries.map(([type, amount]) => <div key={type} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5"><span className="text-[13px] text-slate-700 sm:text-sm">{type}</span><strong className="text-[13px] text-slate-900 sm:text-sm">{formatMoney(amount)}</strong></div>) : <p className="text-[13px] text-slate-500 sm:text-sm">ငွေချေမှုမရှိသေးပါ။</p>}</div></div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
