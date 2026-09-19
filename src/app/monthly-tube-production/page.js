'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function currentMonth() {
  const now = new Date(Date.now() + (6 * 60 + 30) * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
function number(value) { return Number(value || 0).toLocaleString(); }
function decimal(value) { return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 }); }
function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function metric(row, key) { return Number(row?.material?.[key] || 0); }

const materialFields = [
  ["usedGlueKg", "သုံးကော်စေ့ kg"], ["usedGlueBags", "သုံးကော်စေ့ အိတ်"],
  ["remainingGlueKg", "ကျန်ကော်စေ့ kg"], ["remainingGlueBags", "ကျန်ကော်စေ့ အိတ်"],
  ["scrapKg", "ခုတ်ဖက် kg"], ["tubeDamageKg", "Tube ပျက် kg"],
  ["glueWasteKg", "ကော်ပျက် kg"], ["scrapTubeCount", "ခုတ်ဖက်အရေအတွက်"], ["scrapGlueCount", "ကော်စေ့အရေအတွက်"],
];

export default function MonthlyTubeProductionPage() {
  const [month, setMonth] = useState(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("month") : "") || currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/monthly-tube-production?month=${encodeURIComponent(month)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "တစ်လစာ Tube ထွက်ရှိမှု ရယူ၍မရပါ။"); setData(body.data); })
      .catch((fetchError) => { if (fetchError.name !== "AbortError") setError(fetchError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["တစ်လစာ Tube ထွက်ရှိမှု", month], [],
      ["ရက်စွဲ", "မှတ်တမ်း", "အိတ်", "Tube pcs", "သုံးကော်စေ့ kg", "ကျန်ကော်စေ့ kg", "ခုတ်ဖက် kg", "Tube ပျက် kg", "ကော်ပျက် kg"],
      ...(data.dailySummaries || []).map((row) => [row.date, row.reports, row.packs, row.pieces, metric(row, "usedGlueKg"), metric(row, "remainingGlueKg"), metric(row, "scrapKg"), metric(row, "tubeDamageKg"), metric(row, "glueWasteKg")]), [],
      ["Tube အမျိုးအစား", "pcs/အိတ်", "အိတ်", "pcs", "မှတ်တမ်း"],
      ...(data.typeSummaries || []).map((row) => [row.tubeType, row.capacity, row.packs, row.pieces, row.reports]), [],
      ["စက်", "မှတ်တမ်း", "အိတ်", "pcs"],
      ...(data.machineSummaries || []).map((row) => [row.machineName, row.reports, row.packs, row.pieces]), [],
      ["Material Summary", "တန်ဖိုး"],
      ...materialFields.map(([key, label]) => [label, data.materialTotals?.[key] || 0]), [],
      ["အသေးစိတ်", "ရက်စွဲ", "စက်", "Tube", "အိတ်", "pcs/အိတ်", "စုစုပေါင်း pcs", "ပူးတွဲဆင်းသူများ"],
      ...(data.rows || []).map((row) => ["Production", row.reportDate, row.machineName || row.machineCode, row.tubeType, row.outputQuantity, row.outputCapacity, row.pieces, row.involvedWorkers.join(" · ")]),
    ].map((row) => row.map(csvCell).join(","));
    const blob = new Blob(["\ufeff" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `monthly-tube-production-${month}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const rowsByDate = useMemo(() => {
    const groups = new Map();
    for (const row of data?.rows || []) groups.set(row.reportDate, [...(groups.get(row.reportDate) || []), row]);
    return [...groups.entries()];
  }, [data]);

  return (
    <main className="app-page-main">
      <div className="app-page-container space-y-4">
        <header className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/" className="inline-flex items-center rounded-lg border border-cyan-300 bg-white px-3 py-2 text-sm font-black text-cyan-800 transition hover:bg-cyan-100">← Dashboard ပြန်သွားရန်</Link><p className="mt-3 text-xs font-black uppercase tracking-wide text-cyan-700">Tube Production Summary</p><h1 className="mt-1 text-2xl font-black text-slate-950">တစ်လစာ Tube ထွက်ရှိမှု</h1></div><div className="flex flex-wrap items-end gap-2"><label className="flex flex-col gap-2 text-sm font-black text-slate-700">လ ရွေးရန်<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-12 rounded-xl border-2 border-cyan-300 bg-white px-3 text-base font-black" /></label><button type="button" onClick={exportCsv} disabled={loading || !data} className="h-12 rounded-xl bg-emerald-600 px-5 font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">CSV ပြန်ထုတ်ရန်</button></div></div>
        </header>
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</div> : null}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-black text-cyan-700">စုစုပေါင်း Tube pcs</p><p className="mt-2 text-2xl font-black text-cyan-950">{loading ? "—" : `${number(data?.totals?.pieces)} pcs`}</p></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black text-emerald-700">စုစုပေါင်းအိတ်</p><p className="mt-2 text-2xl font-black text-emerald-950">{loading ? "—" : `${number(data?.totals?.packs)} အိတ်`}</p></div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4"><p className="text-xs font-black text-indigo-700">မှတ်တမ်းအကြိမ်</p><p className="mt-2 text-2xl font-black text-indigo-950">{loading ? "—" : `${number(data?.totals?.reports)} ကြိမ်`}</p></div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-xs font-black text-rose-700">Tube ပျက်</p><p className="mt-2 text-2xl font-black text-rose-950">{loading ? "—" : `${decimal(data?.totals?.tubeDamageKg)} kg`}</p></div>
        </section>
        {loading ? <div className="rounded-xl border bg-white p-10 text-center font-bold text-slate-500">တစ်လစာ Tube ထွက်ရှိမှု ရယူနေသည်...</div> : null}
        {!loading && data ? <>
          <details className="group rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm sm:p-5"><summary className="cursor-pointer list-none text-xl font-black text-indigo-950 marker:hidden"><span className="mr-2 inline-block transition-transform group-open:rotate-90">▶</span>1. Tube အမျိုးအစားအလိုက် စုစုပေါင်း</summary><div className="mt-3 overflow-x-auto rounded-xl border border-indigo-200 bg-white"><table className="w-full min-w-[620px] text-sm"><thead className="bg-indigo-100 text-indigo-950"><tr><th className="px-3 py-3 text-left">Tube အမျိုးအစား</th><th className="px-3 py-3 text-right">pcs/အိတ်</th><th className="px-3 py-3 text-right">အိတ်</th><th className="px-3 py-3 text-right">စုစုပေါင်း pcs</th><th className="px-3 py-3 text-right">မှတ်တမ်း</th></tr></thead><tbody>{data.typeSummaries.length ? data.typeSummaries.map((row) => <tr key={`${row.tubeType}-${row.capacity}`} className="border-t border-indigo-100"><td className="px-3 py-3 font-black">{row.tubeType}</td><td className="px-3 py-3 text-right">{number(row.capacity)}</td><td className="px-3 py-3 text-right font-black text-emerald-700">{number(row.packs)}</td><td className="px-3 py-3 text-right font-black text-cyan-800">{number(row.pieces)}</td><td className="px-3 py-3 text-right">{number(row.reports)}</td></tr>) : <tr><td colSpan="5" className="px-3 py-8 text-center font-bold text-slate-500">ဒီလအတွက် Tube ထွက်ရှိမှု မရှိသေးပါ။</td></tr>}</tbody></table></div></details>
          <details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><summary className="cursor-pointer list-none text-xl font-black text-slate-900 marker:hidden"><span className="mr-2 inline-block transition-transform group-open:rotate-90">▶</span>2. ရက်စွဲအလိုက် စုစုပေါင်း</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b-2 border-slate-200 text-left text-xs text-slate-500"><th className="px-2 py-3">ရက်စွဲ</th><th className="px-2 py-3 text-right">မှတ်တမ်း</th><th className="px-2 py-3 text-right">အိတ်</th><th className="px-2 py-3 text-right">Tube pcs</th><th className="px-2 py-3 text-right">သုံးကော်စေ့ kg</th><th className="px-2 py-3 text-right">ကျန်ကော်စေ့ kg</th><th className="px-2 py-3 text-right">Tube ပျက် kg</th></tr></thead><tbody>{data.dailySummaries.map((row) => <tr key={row.date} className="border-b border-slate-100"><td className="px-2 py-3 font-bold">{row.date}</td><td className="px-2 py-3 text-right">{number(row.reports)}</td><td className="px-2 py-3 text-right text-emerald-700">{number(row.packs)}</td><td className="px-2 py-3 text-right font-black text-cyan-700">{number(row.pieces)}</td><td className="px-2 py-3 text-right">{decimal(row.material.usedGlueKg)}</td><td className="px-2 py-3 text-right">{decimal(row.material.remainingGlueKg)}</td><td className="px-2 py-3 text-right text-rose-700">{decimal(row.material.tubeDamageKg)}</td></tr>)}</tbody></table></div></details>
          <details className="group rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm sm:p-5"><summary className="cursor-pointer list-none text-xl font-black text-blue-950 marker:hidden"><span className="mr-2 inline-block transition-transform group-open:rotate-90">▶</span>3. စက်အလိုက် စုစုပေါင်း</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.machineSummaries.length ? data.machineSummaries.map((row) => <div key={row.machineCode || row.machineName} className="rounded-xl border border-blue-100 bg-white p-4"><h3 className="font-black text-blue-950">{row.machineName}</h3><p className="mt-2 text-sm font-bold text-slate-600">မှတ်တမ်း {number(row.reports)} ကြိမ်</p><p className="mt-1 text-lg font-black text-emerald-700">{number(row.packs)} အိတ်</p><p className="mt-1 text-sm font-black text-cyan-800">{number(row.pieces)} pcs</p></div>) : <p className="rounded-xl border border-dashed border-blue-200 bg-white p-6 text-center font-bold text-slate-500 sm:col-span-2 lg:col-span-3">ဒီလအတွက် စက်အလိုက် data မရှိသေးပါ။</p>}</div></details>
          <details className="group rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm sm:p-5"><summary className="cursor-pointer list-none text-xl font-black text-amber-950 marker:hidden"><span className="mr-2 inline-block transition-transform group-open:rotate-90">▶</span>4. Material Summary</summary><p className="mt-3 text-sm font-semibold text-amber-800">သုံးကော်စေ့၊ ကျန်ကော်စေ့၊ Tube ပျက်၊ ကော်ပျက်နှင့် ခုတ်ဖက်တို့ကို လအတွင်း စုစုပေါင်းပေါင်းထားပါသည်။</p><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{materialFields.map(([key, label]) => <p key={key} className="rounded-xl bg-white p-3 font-black text-amber-950">{label}<br /><span className="text-lg">{decimal(data.materialTotals?.[key])}</span></p>)}</div></details>
          <details className="group rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 shadow-sm sm:p-5"><summary className="cursor-pointer list-none text-xl font-black text-cyan-950 marker:hidden"><span className="mr-2 inline-block transition-transform group-open:rotate-90">▶</span>5. ထုတ်လုပ်မှုမှတ်တမ်း အသေးစိတ်</summary><div className="mt-4 space-y-3">{rowsByDate.length ? rowsByDate.map(([date, rows]) => <details key={date} className="rounded-xl border border-cyan-100 bg-white p-3"><summary className="cursor-pointer font-black text-cyan-950">{date} · {number(rows.length)} မှတ်တမ်း · {number(rows.reduce((sum, row) => sum + row.pieces, 0))} pcs</summary><div className="mt-3 space-y-2">{rows.map((row) => <article key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-black text-slate-900">{row.tubeType}</h3><p className="text-sm font-bold text-slate-500">{row.machineName || row.machineCode} · {row.actorName || "User"}</p></div><span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-black text-cyan-800">{number(row.outputQuantity)} အိတ် × {number(row.outputCapacity)} pcs</span></div><p className="mt-2 rounded-lg bg-cyan-50 p-2 font-black text-cyan-950">စုစုပေါင်း {number(row.pieces)} pcs</p><p className="mt-2 text-sm font-bold text-blue-900">ပူးတွဲဆင်းသူများ: {row.involvedWorkers.length ? row.involvedWorkers.join(" · ") : "မရှိ"}</p><div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3"><span>သုံးကော်စေ့: {decimal(row.tubeMetrics?.usedGlueKg)} kg / {decimal(row.tubeMetrics?.usedGlueBags)} အိတ်</span><span>ကျန်ကော်စေ့: {decimal(row.tubeMetrics?.remainingGlueKg)} kg / {decimal(row.tubeMetrics?.remainingGlueBags)} အိတ်</span><span>ခုတ်ဖက်: {decimal(row.tubeMetrics?.scrapKg)} kg</span><span>Tube ပျက်: {decimal(row.tubeMetrics?.tubeDamageKg)} kg</span><span>ကော်ပျက်: {decimal(row.tubeMetrics?.glueWasteKg)} kg</span><span>ခုတ်ဖက်/ကော်စေ့: {decimal(row.tubeMetrics?.scrapTubeCount)} / {decimal(row.tubeMetrics?.scrapGlueCount)}</span></div></article>)}</div></details>) : <div className="rounded-xl border border-dashed border-cyan-200 bg-white p-8 text-center font-bold text-slate-500">ဒီလအတွက် Tube ထွက်ရှိမှု မရှိသေးပါ။</div>}</div></details>
        </> : null}
      </div>
    </main>
  );
}
