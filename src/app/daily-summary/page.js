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

function AiExplanationPanel({ explanation, date }) {
  const findings = Array.isArray(explanation?.findings) ? explanation.findings : [];
  const checks = Array.isArray(explanation?.checks) ? explanation.checks : [];
  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50 p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-violet-950">AI ရှင်းပြချက်</h2>
        <span className="text-xs font-semibold text-violet-700">စာရင်းရက်စွဲ {date}</span>
      </div>
      <p className="mt-1 text-xs text-violet-700">Daily Summary နှင့် genuine Activity History ကို ပေါင်းစပ်ဖတ်ရှုထားသော ရှင်းပြချက်</p>

      <div className="mt-4 rounded-lg border border-violet-100 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">အနှစ်ချုပ်</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">{cleanAiText(explanation?.overview) || "အနှစ်ချုပ် မရရှိပါ။"}</p>
      </div>

      {findings.length > 0 && <div className="mt-4">
        <h3 className="text-base font-bold text-slate-900">အဓိကတွေ့ရှိချက်များ</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{findings.map((item, index) => <div key={`finding-${index}`} className="rounded-lg border border-emerald-100 bg-white p-3 text-sm leading-6 text-slate-800"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">{index + 1}</span>{cleanAiText(item)}</div>)}</div>
      </div>}

      {checks.length > 0 && <div className="mt-4">
        <h3 className="text-base font-bold text-slate-900">ပြန်စစ်သင့်သည့်အချက်များ</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{checks.map((item, index) => <div key={`check-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900">{index + 1}</span>{cleanAiText(item)}</div>)}</div>
      </div>}

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">သတိပြုရန်</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">{cleanAiText(explanation?.caution) || "အရေးကြီးသည့် စာရင်းများကို Website ထဲတွင် ပြန်စစ်ပါ။"}</p>
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
    fetchJson(`/api/daily-summary?date=${date}`)
      .then((result) => active && setData(result))
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
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <a href="/" className="text-sm font-medium text-cyan-700">← Dashboard</a>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">Daily Summary</h1>
              <p className="mt-1 text-sm text-slate-600">ရွေးထားသောနေ့၏ ငွေချေမှုနှင့် အကြွေးတိုးမှု အသေးစိတ်</p>
              <p className="mt-2 text-xs font-medium text-cyan-700">Report Date: {safeMyanmarDateLabel(date)}</p>
              <p className="mt-1 text-xs text-slate-500">Time Range: 00:00–23:59 (Myanmar Time)</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-56 sm:items-end">
              <input type="date" value={date} onChange={(e) => { const nextDate = e.target.value; if (isValidDateInput(nextDate)) setDate(nextDate); }} className="block min-w-0 w-full max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 sm:w-auto" />
              <button type="button" onClick={handleAiExplain} disabled={loading || aiLoading} className="min-h-11 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:bg-slate-400 sm:w-auto">
                {aiLoading ? "AI ရှင်းပြနေသည်..." : "AI ဖြင့် ရှင်းပြရန်"}
              </button>
            </div>
          </div>
          {aiError && <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4"><h2 className="text-base font-semibold text-rose-900">AI ရှင်းပြချက် အမှား</h2><p className="mt-2 whitespace-pre-wrap text-sm text-rose-800">{aiError}</p></section>}
          {aiExplanation && <AiExplanationPanel explanation={aiExplanation} date={date} />}
        </header>

        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>}
        {loading ? <div className="rounded-xl bg-white p-8 text-center text-slate-600">Summary ရယူနေသည်...</div> : data && (
          <>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">စာရင်းရက်စွဲအလိုက် ငွေချေ/အကြွေးတိုး</p>
            </div>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm text-emerald-700">ငွေချေသူ</p><p className="mt-2 text-3xl font-bold text-emerald-800">{data.summary.paidCount}</p><p className="mt-1 text-sm text-emerald-700">{formatMoney(data.summary.paidAmount)}</p></div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-5"><p className="text-sm text-rose-700">အကြွေးတိုးသူ</p><p className="mt-2 text-3xl font-bold text-rose-800">{data.summary.unpaidCount}</p><p className="mt-1 text-sm text-rose-700">{formatMoney(data.summary.unpaidAmount)}</p></div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5"><p className="text-sm text-blue-700">Transaction စုစုပေါင်း</p><p className="mt-2 text-3xl font-bold text-blue-800">{data.summary.totalTransactions}</p></div>
              <a href={`/activity?date=${date}`} className="rounded-xl border border-violet-200 bg-violet-50 p-5 transition hover:border-violet-300 hover:bg-violet-100"><p className="text-sm text-violet-700">ရွေးထားသောနေ့ လုပ်ဆောင်ချက်</p><p className="mt-2 text-3xl font-bold text-violet-800">{data.summary.activityCount ?? data.summary.auditCount}</p><p className="mt-1 text-xs text-violet-700">အသေးစိတ်ကြည့်ရန် →</p></a>
            </section>

            <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
                <h2 className="text-lg font-semibold text-slate-900">Customer အလိုက် စာရင်းချုပ်</h2>
                <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Customer</th><th className="px-3 py-3 text-right">ငွေချေ</th><th className="px-3 py-3 text-right">အကြွေးတိုး</th></tr></thead><tbody className="divide-y divide-slate-100">{data.customers.length ? data.customers.map((customer) => <tr key={customer.customerId}><td className="px-3 py-3 font-medium text-slate-800">{customer.customerName}</td><td className="px-3 py-3 text-right text-emerald-700">{customer.paidCount} / {formatMoney(customer.paidAmount)}</td><td className="px-3 py-3 text-right text-rose-700">{customer.unpaidCount} / {formatMoney(customer.unpaidAmount)}</td></tr>) : <tr><td colSpan="3" className="px-3 py-8 text-center text-slate-500">ဒီနေ့စာရင်းမရှိသေးပါ။</td></tr>}</tbody></table></div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-900">Payment Type</h2><div className="mt-4 space-y-3">{paymentEntries.length ? paymentEntries.map(([type, amount]) => <div key={type} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3"><span className="text-sm text-slate-700">{type}</span><strong className="text-sm text-slate-900">{formatMoney(amount)}</strong></div>) : <p className="text-sm text-slate-500">ငွေချေမှုမရှိသေးပါ။</p>}</div></div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
