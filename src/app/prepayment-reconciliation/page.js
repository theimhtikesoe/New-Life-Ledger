"use client";

import { useEffect, useMemo, useState } from "react";

const money = (value) => `${Number(value || 0).toLocaleString("en-US")} Ks`;
const dateLabel = (value) => new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function PrepaymentReconciliationPage() {
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError("");
      try {
        let response;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          response = await fetch("/api/prepayment-reconciliation", { cache: "no-store" });
          if (response.ok) break;
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "စာရင်းရယူ၍ မရပါ။");
        if (active) { setCustomers(body.data || []); setSelectedId(body.data?.[0]?.id || ""); }
      } catch (loadError) { if (active) setError(loadError.message || "စာရင်းရယူ၍ မရပါ။"); }
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return customers.filter((customer) => !term || `${customer.name} ${customer.phone || ""} ${customer.routeTag || ""}`.toLocaleLowerCase().includes(term));
  }, [customers, query]);
  const selected = customers.find((customer) => customer.id === selectedId) || filtered[0] || null;
  const total = customers.reduce((sum, customer) => sum + Number(customer.prepaymentBalance || 0), 0);

  return <main className="app-page-main"><div className="app-page-container app-page-surface">
    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}</div> : null}
    <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-800">လက်ရှိကြိုတင်ငွေချေရှိသူ</p><p className="mt-2 text-2xl font-black text-emerald-700">{loading ? "…" : `${customers.length} ယောက်`}</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2"><p className="text-sm font-bold text-emerald-800">ကြိုတင်ငွေချေလက်ကျန် စုစုပေါင်း</p><p className="mt-2 text-2xl font-black text-emerald-700">{loading ? "…" : money(total)}</p></div></section>
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"><div className="rounded-2xl border border-emerald-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-black text-slate-900">ကြိုတင်ငွေချေရှိသူများ</h2><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">{filtered.length} ယောက်</span></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer ရှာရန်" className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />{loading ? <p className="py-8 text-center text-sm text-slate-500">ရယူနေသည်...</p> : <div className="mt-3 grid max-h-[620px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((customer) => <button key={customer.id} type="button" onClick={() => setSelectedId(customer.id)} className={`min-h-[92px] rounded-xl border p-3 text-left transition ${selected?.id === customer.id ? "border-emerald-500 bg-emerald-100 shadow-sm" : "border-emerald-100 bg-emerald-50/50 hover:bg-emerald-100"}`}><div className="flex items-start justify-between gap-2"><span className="line-clamp-2 font-black leading-5 text-slate-900">{customer.name}</span><span className="whitespace-nowrap text-sm font-black text-emerald-700">{money(customer.prepaymentBalance)}</span></div><span className="mt-2 block truncate text-xs text-slate-500">{customer.routeTag || "လမ်းကြောင်းမရှိ"}</span><span className="mt-1 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">လက်ကျန်ကြိုချေ</span></button>)}{!filtered.length ? <p className="col-span-full py-8 text-center text-sm text-slate-500">လက်ရှိ ကြိုတင်ငွေချေရှိသူ မတွေ့ပါ။</p> : null}</div>}</div>
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">{selected ? <><div className="rounded-2xl border border-emerald-300 bg-emerald-100 p-4"><p className="text-xs font-black text-emerald-800">ရွေးထားသော Customer</p><h2 className="mt-1 text-xl font-black text-emerald-950">{selected.name}</h2><p className="mt-1 text-sm text-emerald-800">လက်ရှိကြိုတင်ငွေချေလက်ကျန်</p><p className="mt-2 text-3xl font-black text-emerald-700">{money(selected.prepaymentBalance)}</p></div><div className="mt-3 rounded-2xl border border-emerald-200 bg-white p-3"><h3 className="font-black text-slate-900">မကျေသေးတဲ့ ကြိုတင်ငွေချေ</h3><div className="mt-3 space-y-2">{selected.matches.map((match) => <div key={match.payment.id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-emerald-800">ငွေကြိုချေ / ငွေချေ</p><p className="mt-1 font-black text-slate-900">{dateLabel(match.payment.date)}</p><p className="text-xs text-slate-600">{match.payment.paymentType || "နည်းလမ်းမသတ်မှတ်ရသေး"}</p></div><span className="whitespace-nowrap text-sm font-black text-emerald-700">{money(match.remainingAmount)}</span></div></div>)}</div></div><a href={`/ledger?customerId=${encodeURIComponent(selected.id)}`} className="mt-3 inline-flex rounded-xl bg-cyan-700 px-4 py-3 text-sm font-black text-white hover:bg-cyan-800">Customer Ledger →</a></> : <div className="py-16 text-center text-slate-500">Customer ကို ရွေးပါ။</div>}</div></section>
  </div></main>;
}
