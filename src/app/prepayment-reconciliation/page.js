"use client";

import { useEffect, useMemo, useState } from "react";

const money = (value) => `${Math.round(Number(value || 0)).toLocaleString("en-US")} Ks`;
const dateLabel = (value) => value ? new Intl.DateTimeFormat("my-MM", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) : "—";

export default function PrepaymentReconciliationPage() {
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/prepayment-reconciliation", { cache: "no-store" })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "စာရင်းရယူ၍မရပါ။"); return body.data || []; })
      .then((rows) => { setCustomers(rows); if (rows.length) setSelectedId(rows[0].id); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => customers.filter((customer) => `${customer.name} ${customer.phone || ""} ${customer.routeTag || ""}`.toLocaleLowerCase("my-MM").includes(query.trim().toLocaleLowerCase("my-MM"))), [customers, query]);
  const selected = customers.find((customer) => customer.id === selectedId) || filtered[0];
  const totalMatches = customers.reduce((sum, customer) => sum + customer.matches.length, 0);

  return <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-5 lg:px-8"><div className="mx-auto max-w-[1500px]">
    <div className="rounded-2xl border border-violet-100 bg-white/90 p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.2em] text-violet-700">New Life Ledger · Control Room</p><p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">ငွေကြိုချေထားပြီး နောက် ၃ ရက်အတွင်း တူညီပမာဏအကြွေးတိုးလာသော မှတ်တမ်းများကို စစ်ရန်နေရာပါ။ အောက်ပါ match ကို အတည်ပြုမပြီးမချင်း ငွေချေထပ်မထည့်ပါနှင့်။</p></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><div className="flex items-center justify-between gap-2"><h2 className="font-black">ကြိုတင်ငွေချေ စစ်ရန်</h2><span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-black text-violet-700">{filtered.length} ယောက်</span></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Customer ရှာရန်" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" /><div className="mt-3 max-h-[62vh] overflow-y-auto pr-1">{loading ? <p className="p-3 text-sm text-slate-500">ရယူနေသည်...</p> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">{filtered.map((customer) => <button key={customer.id} onClick={() => setSelectedId(customer.id)} className={`min-w-0 rounded-xl border p-3 text-left ${selected?.id === customer.id ? "border-violet-500 bg-violet-50 ring-2 ring-violet-300" : "border-slate-200 bg-slate-50 hover:border-violet-300"}`}><p className="truncate text-sm font-black">{customer.name}</p><p className="mt-1 text-xs text-slate-500">{customer.matches.length} ခု စစ်ရန်</p><p className="mt-1 text-sm font-black text-rose-700">{money(customer.websiteBalance)}</p></button>)}</div>}{!loading && !filtered.length ? <p className="p-3 text-sm text-slate-500">စစ်ရန်မှတ်တမ်းမရှိပါ။</p> : null}</div></aside>
      <section className="min-w-0">{error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}{selected ? <div className="space-y-4"><div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm sm:p-5"><p className="text-xs font-bold text-violet-700">ရွေးထားသော Customer</p><h2 className="mt-1 text-2xl font-black">{selected.name}</h2><p className="mt-1 text-sm text-slate-600">{selected.routeTag || "လမ်းကြောင်းမရှိ"} · Website လက်ကျန် {money(selected.websiteBalance)}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white p-3"><p className="text-xs font-bold text-violet-700">ဖြစ်နိုင်သော ကြိုတင်ငွေချေ match</p><p className="mt-1 text-2xl font-black text-violet-900">{selected.matches.length} ခု</p></div><div className="rounded-xl bg-amber-50 p-3"><p className="text-xs font-bold text-amber-700">လုပ်ဆောင်ရန်</p><p className="mt-1 text-sm font-black text-amber-900">အကြွေးတိုးအသစ်နဲ့ ကိုက်မကိုက် စစ်ပါ</p></div></div></div><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h3 className="text-lg font-black">ငွေကြိုချေ → နောက်ရက်အကြွေးတိုး</h3><p className="mt-1 text-sm text-slate-500">မှတ်တမ်းတူတာကို ပြထားခြင်းသာဖြစ်ပြီး မူရင်း payment/debt ကို မပြင်ပါ။ ကိုက်ညီကြောင်းသေချာလျှင် ငွေချေထပ်မထည့်ပါနှင့်။</p><div className="mt-4 space-y-3">{selected.matches.map((match) => <article key={match.payment.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"><div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center"><div><p className="text-xs font-bold text-slate-500">ငွေချေ / ငွေကြိုချေ</p><p className="mt-1 font-black">{dateLabel(match.payment.date)} · {money(match.payment.amount)}</p><p className="text-xs text-slate-600">{match.payment.paymentType || "ငွေချေ"} {match.explicit ? "· __PREPAYMENT__" : "· အဟောင်း marker မပါ"}</p></div><div className="text-center text-2xl font-black text-violet-600">→</div><div><p className="text-xs font-bold text-slate-500">ကိုက်ညီနိုင်သော အကြွေးတိုး</p>{match.futureCredits.map((credit) => <p key={credit.id} className="mt-1 font-black text-rose-700">{dateLabel(credit.date)} · {money(credit.amount)}</p>)}</div></div>{match.hasOlderCredits ? <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-800">အရင်အကြွေးဟောင်းရှိနေသဖြင့် ဒီငွေချေကို အရင်အကြွေးထဲ မချေပါနှင့်။</p> : null}</article>)}</div></div></div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">{loading ? "ရယူနေသည်..." : `စစ်ရန် match ${totalMatches} ခု ရှိပါသည်။ Customer ရွေးပါ။`}</div>}</section>
    </div>
  </div></main>;
}
