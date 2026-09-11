"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const money = new Intl.NumberFormat("en-US");
const formatMoney = (value) => `${money.format(Math.round(Number(value || 0)))} Ks`;

export default function DiscountsPage() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/discounts?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Discount စာရင်း ရယူ၍ မရပါ။");
        return payload.data;
      })
      .then((data) => { if (active) { setRows(data?.rows || []); setError(""); setLoading(false); } })
      .catch((err) => { if (active) { setError(err.message); setLoading(false); } });
    return () => { active = false; };
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = row.customerId;
      const current = map.get(key) || { customer: row.customer, total: 0, count: 0, rows: [] };
      current.total += row.discountAmount || 0;
      current.count += 1;
      current.rows.push(row);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><Link href="/" className="text-sm font-semibold text-cyan-700 hover:underline">← Dashboard</Link><h1 className="mt-3 text-2xl font-black">Customer လျှော့စျေးမှတ်တမ်း</h1><p className="mt-1 text-sm text-slate-500">Customer အလိုက် ပေးထားသော လျှော့စျေးများကို ပြန်ကြည့်ရန်</p></div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-right"><p className="text-xs font-semibold text-amber-700">စုစုပေါင်းလျှော့စျေး</p><p className="mt-1 text-xl font-black text-amber-900">{formatMoney(rows.reduce((sum, row) => sum + (row.discountAmount || 0), 0))}</p></div>
          </div>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setLoading(true); }} placeholder="Customer အမည်ရှာရန်" className="mt-5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-amber-500" />
        </header>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div> : null}
        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">စာရင်းရယူနေသည်...</div> : null}
        {!loading && !error ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {grouped.map((group) => <section key={group.customer.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3"><div><Link href={`/ledger?customerId=${encodeURIComponent(group.customer.id)}`} className="font-bold text-cyan-800 hover:underline">{group.customer.name}</Link><p className="mt-1 text-xs text-slate-500">{group.count} ကြိမ်</p></div><p className="text-lg font-black text-amber-700">{formatMoney(group.total)}</p></div><div className="mt-3 space-y-2">{group.rows.map((row) => <div key={row.id} className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-600">{new Date(row.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span><strong className="text-amber-800">{formatMoney(row.discountAmount)}</strong></div><p className="mt-1 text-xs text-slate-600">ငွေချေ {formatMoney(row.amount)} · {row.paymentType || "မသတ်မှတ်ရသေးပါ"}</p>{row.discountNote ? <p className="mt-1 text-xs font-semibold text-amber-900">အကြောင်းပြချက် — {row.discountNote}</p> : null}</div>)}</div></section>)}
            {!grouped.length ? <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">လျှော့စျေးမှတ်တမ်း မရှိသေးပါ။</div> : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
