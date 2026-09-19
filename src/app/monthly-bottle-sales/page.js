'use client';

import { useEffect, useMemo, useState } from "react";

function currentMonth() {
  const now = new Date();
  const local = new Date(now.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}
function money(value) { return `${Number(value || 0).toLocaleString()} Ks`; }
function number(value) { return Number(value || 0).toLocaleString(); }
function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function tubeGroup(tubeType) {
  const value = String(tubeType || "").trim();
  const grams = value.match(/(13g|16g|24g)/i)?.[1]?.toLowerCase() || "မသတ်မှတ်ရသေး";
  const color = /\bW\b|အဖြူ/i.test(value) ? "အဖြူ" : /\bB\b|ပြာ|S\+1|S\+S/i.test(value) ? "အပြာ" : "မသတ်မှတ်ရသေး";
  return { grams, color, label: value || "Tube မသတ်မှတ်ရသေး" };
}

export default function MonthlyBottleSalesPage() {
  const [month, setMonth] = useState(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("month") : "") || currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/monthly-bottle-sales?month=${encodeURIComponent(month)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "လစဉ် ဗူးရောင်းစာရင်း ရယူ၍မရပါ။"); setData(body.data); })
      .catch((fetchError) => { if (fetchError.name !== "AbortError") setError(fetchError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month]);
  const items = useMemo(() => {
    const map = new Map();
    for (const customer of data?.customers || []) for (const item of customer.items || []) {
      const key = `${item.productKey}::${item.capacity}`;
      const current = map.get(key) || { ...item, cardCount: 0, bottleCount: 0, totalAmount: 0 };
      current.cardCount += Number(item.cardCount || 0); current.bottleCount += Number(item.bottleCount || 0); current.totalAmount += Number(item.totalAmount || 0); map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.bottleCount - a.bottleCount);
  }, [data]);
  const tubeItems = useMemo(() => {
    const map = new Map();
    for (const tubeType of data?.tubeTypes || []) {
      const group = tubeGroup(tubeType);
      const key = `${group.grams}::${group.color}::${group.label}`;
      map.set(key, { ...group, tubeType, bottleCount: 0, cardCount: 0, totalAmount: 0 });
    }
    for (const item of items) {
      const group = tubeGroup(item.tubeType);
      if (!item.tubeType) continue;
      const key = `${group.grams}::${group.color}::${group.label}`;
      const current = map.get(key) || { ...group, tubeType: item.tubeType, bottleCount: 0, cardCount: 0, totalAmount: 0 };
      current.bottleCount += Number(item.bottleCount || 0);
      current.cardCount += Number(item.cardCount || 0);
      current.totalAmount += Number(item.totalAmount || 0);
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => a.grams.localeCompare(b.grams) || a.color.localeCompare(b.color) || b.bottleCount - a.bottleCount);
  }, [items]);
  const tubeBottleGroups = useMemo(() => {
    const soldByKey = new Map(items.map((item) => [item.productKey, item]));
    const groups = new Map();
    for (const mapping of data?.tubeBottleMappings || []) {
      const group = tubeGroup(mapping.tubeType);
      const current = groups.get(mapping.tubeType) || { ...group, bottles: [] };
      const sold = soldByKey.get(`${mapping.productKey}::${mapping.capacity}`) || soldByKey.get(mapping.productKey);
      current.bottles.push({ ...mapping, bottleCount: sold?.bottleCount || 0, totalAmount: sold?.totalAmount || 0 });
      groups.set(mapping.tubeType, current);
    }
    return [...groups.values()].sort((a, b) => a.grams.localeCompare(b.grams) || a.color.localeCompare(b.color) || a.label.localeCompare(b.label));
  }, [data, items]);
  function exportCsv() {
    const lines = [
      ["လစဉ် ဗူးရောင်းစာရင်း", month], [],
      ["ရက်စွဲ", "Customer", "ရောင်းဗူး", "ရောင်းတန်ဖိုး", "တကယ်ရရှိငွေ", "အကြွေးတိုးဗူး"],
      ...(data?.daily || []).map((row) => [row.date, row.customers, row.bottles, row.amount, row.paidAmount, row.creditBottles]), [],
      ["Item အလိုက် စုစုပေါင်း", "ဆံ့/ကဒ်", "ကဒ်", "ဗူး", "ငွေ"],
      ...items.map((item) => [item.productName, item.capacity, item.cardCount, item.bottleCount, item.totalAmount]),
      [], ["Tube အလိုက် စုစုပေါင်းဗူး", "အရောင်", "Tube", "ကဒ်", "ဗူး", "ငွေ"],
      ...tubeItems.map((item) => [item.grams, item.color, item.tubeType, item.cardCount, item.bottleCount, item.totalAmount]),
    ].map((row) => row.map(csvCell).join(","));
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `monthly-bottle-sales-${month}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return (
    <main className="app-page-main">
      <div className="app-page-container space-y-4">
        <header className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-violet-50 p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label className="flex flex-col gap-2 text-sm font-black text-slate-700">လ ရွေးရန်<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-12 rounded-xl border-2 border-cyan-300 bg-white px-3 text-base font-black" /></label><button type="button" onClick={exportCsv} disabled={loading || !data} className="h-12 rounded-xl bg-emerald-600 px-5 font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">CSV ပြန်ထုတ်ရန်</button></div>
        </header>
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</div> : null}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["စုစုပေါင်း ရောင်းဗူး", `${number(data?.totalBottles)} ဗူး`, "bg-cyan-50 border-cyan-200"], ["စုစုပေါင်း ရောင်းတန်ဖိုး", money(data?.totalAmount), "bg-amber-50 border-amber-200"], ["တကယ်ရရှိငွေ", money(data?.totalPaidAmount), "bg-emerald-50 border-emerald-200"], ["အကြွေးတိုးဗူး", `${number(data?.creditBottleSales?.totalBottles)} ဗူး`, "bg-violet-50 border-violet-200"]].map(([label, value, className]) => <div key={label} className={`rounded-xl border p-4 ${className}`}><p className="text-xs font-black text-slate-600">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{loading ? "—" : value}</p></div>)}
        </section>
        {loading ? <div className="rounded-xl border bg-white p-10 text-center font-bold text-slate-500">လစဉ် ဗူးရောင်းစာရင်း ရယူနေသည်...</div> : null}
        {!loading && data ? <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-xl font-black text-slate-900">ရက်စွဲအလိုက် စုစုပေါင်း</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b-2 border-slate-200 text-left text-xs text-slate-500"><th className="px-2 py-3">ရက်စွဲ</th><th className="px-2 py-3 text-right">Customer</th><th className="px-2 py-3 text-right">ရောင်းဗူး</th><th className="px-2 py-3 text-right">ရောင်းတန်ဖိုး</th><th className="px-2 py-3 text-right">တကယ်ရရှိငွေ</th><th className="px-2 py-3 text-right">အကြွေးတိုးဗူး</th></tr></thead><tbody>{data.daily.map((row) => <tr key={row.date} className="border-b border-slate-100"><td className="px-2 py-3 font-bold">{row.date}</td><td className="px-2 py-3 text-right">{number(row.customers)}</td><td className="px-2 py-3 text-right font-black text-cyan-700">{number(row.bottles)}</td><td className="px-2 py-3 text-right">{money(row.amount)}</td><td className="px-2 py-3 text-right text-emerald-700">{money(row.paidAmount)}</td><td className="px-2 py-3 text-right text-violet-700">{number(row.creditBottles)}</td></tr>)}</tbody></table></div></section>
          <section className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 shadow-sm sm:p-5"><h2 className="text-xl font-black text-cyan-950">Item အလိုက် စုစုပေါင်း</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b-2 border-cyan-200 text-left text-xs text-cyan-800"><th className="px-2 py-3">Item</th><th className="px-2 py-3">ဆံ့/ကဒ်</th><th className="px-2 py-3 text-right">ကဒ်</th><th className="px-2 py-3 text-right">ဗူး</th><th className="px-2 py-3 text-right">ငွေ</th></tr></thead><tbody>{items.map((item) => <tr key={`${item.productKey}-${item.capacity}`} className="border-b border-cyan-100"><td className="px-2 py-3 font-bold">{item.productName}</td><td className="px-2 py-3">{number(item.capacity)}</td><td className="px-2 py-3 text-right">{number(item.cardCount)}</td><td className="px-2 py-3 text-right font-black text-cyan-700">{number(item.bottleCount)}</td><td className="px-2 py-3 text-right font-bold">{money(item.totalAmount)}</td></tr>)}</tbody></table></div></section>
          <section className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4 shadow-sm sm:p-5"><h2 className="text-xl font-black text-orange-950">Tube အလိုက် စုစုပေါင်းဗူး</h2><p className="mt-1 text-sm font-semibold text-orange-800">13g / 16g / 24g Tube နှင့် အဖြူ / အပြာ အလိုက် ခွဲပြထားပါသည်။</p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b-2 border-orange-200 text-left text-xs text-orange-800"><th className="px-2 py-3">Tube အမျိုးအစား</th><th className="px-2 py-3">အရောင်</th><th className="px-2 py-3">သတ်မှတ်ချက်</th><th className="px-2 py-3 text-right">ကဒ်</th><th className="px-2 py-3 text-right">စုစုပေါင်းဗူး</th><th className="px-2 py-3 text-right">ငွေ</th></tr></thead><tbody>{tubeItems.length ? tubeItems.map((item) => <tr key={`${item.grams}-${item.color}-${item.tubeType}`} className="border-b border-orange-100"><td className="px-2 py-3 font-black">{item.grams}</td><td className="px-2 py-3 font-bold">{item.color}</td><td className="px-2 py-3">{item.tubeType}</td><td className="px-2 py-3 text-right">{number(item.cardCount)}</td><td className="px-2 py-3 text-right font-black text-orange-700">{number(item.bottleCount)}</td><td className="px-2 py-3 text-right font-bold">{money(item.totalAmount)}</td></tr>) : <tr><td colSpan="6" className="px-2 py-6 text-center font-bold text-slate-500">ဒီလအတွက် Tube mapping ပါသော ရောင်းစာရင်း မရှိသေးပါ။</td></tr>}</tbody></table></div></section>
          <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 shadow-sm sm:p-5"><h2 className="text-xl font-black text-sky-950">Tube နဲ့ သက်ဆိုင်သော ဗူးစာရင်း</h2><p className="mt-1 text-sm font-semibold text-sky-800">သတ်မှတ်ထားသော Tube တစ်မျိုးချင်းစီနဲ့ ထုတ်လုပ်သော ဗူးအမျိုးအစားများကို စုစည်းပြထားပါသည်။</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tubeBottleGroups.length ? tubeBottleGroups.map((group) => <div key={group.label} className="rounded-xl border border-sky-100 bg-white p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-black text-sky-950">{group.grams} · {group.color}</h3><span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-black text-sky-800">{group.label}</span></div><ul className="mt-3 space-y-2">{group.bottles.map((bottle) => <li key={bottle.productKey} className="flex items-start justify-between gap-3 border-b border-sky-50 pb-2 text-sm"><span className="font-bold text-slate-800">{bottle.productName} <span className="font-normal text-slate-500">({number(bottle.capacity)} ဆံ့)</span></span><span className="shrink-0 text-right font-black text-sky-700">{number(bottle.bottleCount)} ဗူး</span></li>)}</ul></div>) : <p className="rounded-xl border border-dashed border-sky-200 bg-white p-6 text-center font-bold text-slate-500 md:col-span-2 xl:col-span-3">Tube mapping ထည့်ထားသော ဗူးအမျိုးအစား မရှိသေးပါ။</p>}</div></section>
          <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm sm:p-5"><h2 className="text-xl font-black text-violet-950">Customer အလိုက် စုစုပေါင်း</h2><div className="mt-3 space-y-2">{(data.customers || []).map((customer) => <div key={customer.customer.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-100 bg-white p-3"><span className="font-black text-slate-900">{customer.customer.name}</span><span className="font-bold text-violet-800">{number(customer.totalBottles)} ဗူး · {money(customer.totalAmount)} · {customer.transactions} ကြိမ်</span></div>)}</div></section>
        </> : null}
      </div>
    </main>
  );
}
