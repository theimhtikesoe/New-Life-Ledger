"use client";

import Link from "next/link";
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
    <section className="page-toolbar"><div className="page-toolbar-row items-start"><div><Link href="/" className="text-sm font-bold text-cyan-700 hover:underline">← Dashboard</Link><p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">New Life Ledger · Control Room</p><h1 className="mt-1 text-2xl font-black text-slate-950">လက်ရှိ ကြိုတင်ငွေချေ စာရင်း</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">အကြွေးဟောင်းတွေနဲ့ မရောဘဲ အခုလက်ရှိ Customer က ပိုငွေချေထားတဲ့ လက်ကျန်ရှိသူတွေကိုပဲ ပြထားပါတယ်။ အစိမ်းရောင်က တကယ် လက်ကျန်ကြိုတင်ငွေ ရှိနေသူကို ဆိုလိုပါတယ်။</p></div></div></section>
    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}</div> : null}
    <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm font-bold text-emerald-800">လက်ရှိကြိုတင်ငွေချေရှိသူ</p><p className="mt-2 text-3xl font-black text-emerald-700">{loading ? "…" : `${customers.length} ယောက်`}</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:col-span-2"><p className="text-sm font-bold text-emerald-800">ကြိုတင်ငွေချေလက်ကျန် စုစုပေါင်း</p><p className="mt-2 text-3xl font-black text-emerald-700">{loading ? "…" : money(total)}</p></div></section>
    <section className="grid gap-4 lg:grid-cols-[320px_1fr]"><div className="rounded-2xl border border-emerald-200 bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-black text-slate-900">ကြိုတင်ငွေချေရှိသူများ</h2><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">{filtered.length} ယောက်</span></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer ရှာရန်" className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />{loading ? <p className="py-8 text-center text-sm text-slate-500">ရယူနေသည်...</p> : <div className="mt-3 max-h-[620px] space-y-2 overflow-y-auto pr-1">{filtered.map((customer) => <button key={customer.id} type="button" onClick={() => setSelectedId(customer.id)} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === customer.id ? "border-emerald-500 bg-emerald-100" : "border-emerald-100 bg-emerald-50/50 hover:bg-emerald-100"}`}><div className="flex items-start justify-between gap-2"><span className="font-black text-slate-900">{customer.name}</span><span className="whitespace-nowrap text-sm font-black text-emerald-700">{money(customer.prepaymentBalance)}</span></div><span className="mt-1 block text-xs text-slate-500">{customer.routeTag || "လမ်းကြောင်းမရှိ"}</span></button>)}{!filtered.length ? <p className="py-8 text-center text-sm text-slate-500">လက်ရှိ ကြိုတင်ငွေချေရှိသူ မတွေ့ပါ။</p> : null}</div>}</div>
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">{selected ? <><div className="rounded-2xl border border-emerald-300 bg-emerald-100 p-5"><p className="text-xs font-black uppercase tracking-wider text-emerald-800">ရွေးထားသော Customer</p><h2 className="mt-1 text-2xl font-black text-emerald-950">{selected.name}</h2><p className="mt-1 text-sm text-emerald-800">လက်ရှိကြိုတင်ငွေချေလက်ကျန်</p><p className="mt-2 text-4xl font-black text-emerald-700">{money(selected.prepaymentBalance)}</p></div><div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4"><h3 className="font-black text-slate-900">တကယ်ကြိုတင်ငွေချေထားသော မှတ်တမ်းများ</h3><p className="mt-1 text-sm leading-6 text-slate-600">အောက်ပါငွေချေတွေဟာ အကြွေးဟောင်းနဲ့ မကျေသေးတဲ့ အကြွေးတိုးတွေကို မရောဘဲ လက်ရှိပိုငွေချေ လက်ကျန်ထဲမှာ ကျန်နေတဲ့ record တွေပါ။</p><div className="mt-4 space-y-3">{selected.matches.map((match) => <div key={match.payment.id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-emerald-800">ငွေကြိုချေ / ငွေချေ</p><p className="mt-1 font-black text-slate-900">{dateLabel(match.payment.date)} · {money(match.payment.amount)}</p><p className="mt-1 text-xs text-slate-600">နည်းလမ်း: {match.payment.paymentType || "မသတ်မှတ်ရသေး"}</p></div><div className="rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-black text-white">လက်ကျန် {money(match.remainingAmount)}</div></div><p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-800">ဒီမှတ်တမ်းက အခုထိ မကျေသေးတဲ့ ကြိုတင်ငွေချေလက်ကျန် ဖြစ်ပါတယ်။ ထပ်ပြီး ငွေချေ record မထည့်ပါနှင့်။</p></div>)}</div></div><Link href={`/ledger?customerId=${encodeURIComponent(selected.id)}`} className="mt-4 inline-flex rounded-xl bg-cyan-700 px-4 py-3 text-sm font-black text-white hover:bg-cyan-800">Customer Ledger ကိုကြည့်ရန် →</Link></> : <div className="py-16 text-center text-slate-500">လက်ရှိ ကြိုတင်ငွေချေရှိသူကို ရွေးပါ။</div>}</div></section>
    <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950"><p className="font-black">ဒီ Page ကို ဘယ်လိုဖတ်မလဲ</p><p className="mt-1">အစိမ်းရောင် Customer တွေက လက်ရှိ Website balance အနုတ်ဖြစ်ပြီး တကယ်ပိုငွေချေထားသူတွေပါ။ အကြွေးဟောင်းနဲ့ အကြွေးတိုးကို ငွေချေပြီးသား record တွေ၊ လက်ကျန် 0 ဖြစ်သူတွေ၊ သာမန်ငွေချေတွေကို ဒီစာရင်းထဲ မထည့်ထားပါ။</p></section>
  </div></main>;
}
