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

async function fetchJson(path) {
  const actorName = localStorage.getItem("actorName") || "";
  const response = await fetch(path, { headers: { "x-actor-name": encodeActorHeader(actorName) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body.data;
}

export default function DailySummaryPage() {
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a href="/" className="text-sm font-medium text-cyan-700">← Dashboard</a>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Daily Summary</h1>
            <p className="mt-1 text-sm text-slate-600">ရွေးထားသောနေ့၏ ငွေချေမှုနှင့် အကြွေးတိုးမှု အသေးစိတ်</p>
            <p className="mt-2 text-xs font-medium text-cyan-700">Report Date: {formatMyanmarDateLabel(`${date}T00:00:00+06:30`)}</p>
            <p className="mt-1 text-xs text-slate-500">Time Range: 00:00–23:59 (Myanmar Time)</p>
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800" />
        </header>

        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>}
        {loading ? <div className="rounded-xl bg-white p-8 text-center text-slate-600">Summary ရယူနေသည်...</div> : data && (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm text-emerald-700">ငွေချေသူ</p><p className="mt-2 text-3xl font-bold text-emerald-800">{data.summary.paidCount}</p><p className="mt-1 text-sm text-emerald-700">{formatMoney(data.summary.paidAmount)}</p></div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-5"><p className="text-sm text-rose-700">အကြွေးတိုးသူ</p><p className="mt-2 text-3xl font-bold text-rose-800">{data.summary.unpaidCount}</p><p className="mt-1 text-sm text-rose-700">{formatMoney(data.summary.unpaidAmount)}</p></div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5"><p className="text-sm text-blue-700">Transaction စုစုပေါင်း</p><p className="mt-2 text-3xl font-bold text-blue-800">{data.summary.totalTransactions}</p></div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-5"><p className="text-sm text-violet-700">လုပ်ဆောင်ချက်မှတ်တမ်း</p><p className="mt-2 text-3xl font-bold text-violet-800">{data.summary.auditCount}</p></div>
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
