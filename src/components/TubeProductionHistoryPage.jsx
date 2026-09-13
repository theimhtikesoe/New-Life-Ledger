'use client';

import { useEffect, useMemo, useState } from "react";

function todayMyanmar() {
  return new Date(Date.now() + (6 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function shiftDate(value, delta) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export default function TubeProductionHistoryPage() {
  const [date, setDate] = useState(() => (typeof window === "undefined" ? todayMyanmar() : (new URLSearchParams(window.location.search).get("date") || todayMyanmar())));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/production-reports?date=${encodeURIComponent(date)}&category=tube`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Tube ထွက်ရှိမှု ရယူ၍မရပါ။");
        setRows((body.data || []).filter((row) => row.category === "tube"));
      })
      .catch((fetchError) => { if (fetchError.name !== "AbortError") setError(fetchError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date]);

  const totals = useMemo(() => rows.reduce((summary, row) => ({
    packs: summary.packs + Number(row.outputQuantity || 0),
    pieces: summary.pieces + Number(row.outputQuantity || 0) * Number(row.outputCapacity || 0),
    reports: summary.reports + 1,
  }), { packs: 0, pieces: 0, reports: 0 }), [rows]);

  const tubeSummaries = useMemo(() => {
    const grouped = new Map();
    rows.forEach((row) => {
      const tubeType = `${row.tubeG || "Tube"} ${row.tubeColor || ""}`.trim();
      const key = `${tubeType}|${row.outputCapacity}`;
      const current = grouped.get(key) || { tubeType, capacity: Number(row.outputCapacity || 0), packs: 0, pieces: 0 };
      current.packs += Number(row.outputQuantity || 0);
      current.pieces += Number(row.outputQuantity || 0) * Number(row.outputCapacity || 0);
      grouped.set(key, current);
    });
    return [...grouped.values()].sort((a, b) => a.tubeType.localeCompare(b.tubeType) || a.capacity - b.capacity);
  }, [rows]);

  const materialTotals = useMemo(() => rows.reduce((summary, row) => {
    const metrics = row.tubeMetrics || {};
    summary.usedGlueKg += Number(metrics.usedGlueKg || 0);
    summary.usedGlueBags += Number(metrics.usedGlueBags || 0);
    summary.remainingGlueKg += Number(metrics.remainingGlueKg || 0);
    summary.remainingGlueBags += Number(metrics.remainingGlueBags || 0);
    summary.scrapKg += Number(metrics.scrapKg || 0);
    summary.tubeDamageKg += Number(metrics.tubeDamageKg || 0);
    summary.glueWasteKg += Number(metrics.glueWasteKg || 0);
    summary.scrapTubeCount += Number(metrics.scrapTubeCount || 0);
    summary.scrapGlueCount += Number(metrics.scrapGlueCount || 0);
    return summary;
  }, { usedGlueKg: 0, usedGlueBags: 0, remainingGlueKg: 0, remainingGlueBags: 0, scrapKg: 0, tubeDamageKg: 0, glueWasteKg: 0, scrapTubeCount: 0, scrapGlueCount: 0 }), [rows]);

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-4 pt-5 sm:pt-6">
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">Tube Production</p>
          <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setDate((value) => shiftDate(value, -1))} className="rounded-lg border-2 border-cyan-300 bg-white px-3 py-2 text-xl font-black text-cyan-800">‹</button><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11 rounded-lg border-2 border-cyan-300 bg-white px-3 text-center font-black text-cyan-950" /><button type="button" onClick={() => setDate((value) => shiftDate(value, 1))} className="rounded-lg border-2 border-cyan-300 bg-white px-3 py-2 text-xl font-black text-cyan-800">›</button></div>
        </section>
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
        <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm"><p className="text-xs font-black text-cyan-700">စုစုပေါင်း Tube</p><p className="mt-1 text-2xl font-black text-cyan-950">{loading ? "ရယူနေသည်..." : `${formatNumber(totals.pieces)} pcs`}</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"><p className="text-xs font-black text-emerald-700">အိတ်အရေအတွက်</p><p className="mt-1 text-2xl font-black text-emerald-900">{loading ? "ရယူနေသည်..." : `${formatNumber(totals.packs)} အိတ်`}</p></div><div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm"><p className="text-xs font-black text-orange-700">မှတ်တမ်းအကြိမ်</p><p className="mt-1 text-2xl font-black text-orange-900">{loading ? "ရယူနေသည်..." : `${formatNumber(totals.reports)} ကြိမ်`}</p></div></section>
        {!loading && rows.length ? <>
          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm"><h2 className="text-lg font-black text-indigo-950">Tube လက်ကျန်ထဲ ပေါင်းမည့် ထုတ်လုပ်မှုအကျဉ်းချုပ်</h2><p className="mt-1 text-sm font-bold text-indigo-800">Tube အမည်နှင့် ဆံ့အလိုက် အိတ်/pcs သီးခြားစီ စုစုပေါင်းပြထားပါသည်။</p><div className="mt-3 overflow-x-auto rounded-xl border border-indigo-200 bg-white"><table className="w-full min-w-[560px] text-sm"><thead className="bg-indigo-100 text-indigo-950"><tr><th className="px-3 py-2 text-left">Tube အမည်</th><th className="px-3 py-2 text-right">ဆံ့</th><th className="px-3 py-2 text-right">အိတ်</th><th className="px-3 py-2 text-right">pcs</th></tr></thead><tbody>{tubeSummaries.map((item) => <tr key={`${item.tubeType}|${item.capacity}`} className="border-t border-indigo-100"><td className="px-3 py-2 font-black">{item.tubeType}</td><td className="px-3 py-2 text-right font-bold">{formatNumber(item.capacity)} pcs/အိတ်</td><td className="px-3 py-2 text-right font-black text-emerald-700">{formatNumber(item.packs)} အိတ်</td><td className="px-3 py-2 text-right font-black text-cyan-800">{formatNumber(item.pieces)} pcs</td></tr>)}</tbody></table></div></section>
          <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm"><h2 className="text-lg font-black text-amber-950">အလေးချိန်ဖြင့် သီးခြားမှတ်တမ်းများ</h2><p className="mt-1 text-sm font-bold text-amber-800">ကော်စေ့၊ ခုတ်ဖက်၊ Tube ပျက်နှင့် ကော်ပျက်တို့ကို Tube pcs အဖြစ် မရေတွက်ဘဲ သီးခြားသယ်ဆောင်/နောက်ပိုင်းလက်ကျန်တွက်ရန် စုစည်းထားပါသည်။</p><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"><p className="rounded-xl bg-white p-3 font-black text-amber-900">သုံးကော်စေ့<br />{materialTotals.usedGlueKg} kg / {materialTotals.usedGlueBags} အိတ်</p><p className="rounded-xl bg-white p-3 font-black text-sky-900">ကျန်ကော်စေ့<br />{materialTotals.remainingGlueKg} kg / {materialTotals.remainingGlueBags} အိတ်</p><p className="rounded-xl bg-white p-3 font-black text-orange-900">ခုတ်ဖက်<br />{materialTotals.scrapKg} kg</p><p className="rounded-xl bg-white p-3 font-black text-rose-900">Tube ပျက်<br />{materialTotals.tubeDamageKg} kg</p><p className="rounded-xl bg-white p-3 font-black text-red-900">ကော်ပျက်<br />{materialTotals.glueWasteKg} kg</p><p className="rounded-xl bg-white p-3 font-black text-slate-900">ခုတ်ဖက် / ကော်စေ့<br />{materialTotals.scrapTubeCount} / {materialTotals.scrapGlueCount}</p></div></section>
        </> : null}
        {!loading && !rows.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center font-bold text-slate-500">{date} အတွက် Tube ထွက်ရှိမှု မရှိသေးပါ။</div> : null}
        {!loading && rows.length ? <section className="space-y-3">{rows.map((row) => { const metrics = row.tubeMetrics || {}; const workers = Array.isArray(row.involvedWorkers) ? row.involvedWorkers : []; return <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-black text-slate-900">{row.tubeG} {row.tubeColor}</h2><p className="text-sm font-bold text-slate-500">{row.machineName || row.machineCode} · {row.actorName || "User"}</p></div><span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-black text-cyan-800">{formatNumber(row.outputQuantity)} အိတ် × {formatNumber(row.outputCapacity)} pcs</span></div><div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-2 text-sm font-bold text-blue-900">ပူးတွဲဆင်းသူများ: {workers.length ? workers.join(" · ") : "မရှိ"}</div><p className="mt-3 rounded-xl bg-cyan-50 p-3 text-base font-black text-cyan-950">စုစုပေါင်း {formatNumber(Number(row.outputQuantity || 0) * Number(row.outputCapacity || 0))} pcs</p><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3"><p className="rounded-lg bg-amber-50 p-2 font-bold text-amber-900">သုံးကော်စေ့: {metrics.usedGlueKg || 0} kg / {metrics.usedGlueBags || 0} အိတ်</p><p className="rounded-lg bg-sky-50 p-2 font-bold text-sky-900">ကျန်ကော်စေ့: {metrics.remainingGlueBags || 0} အိတ် / {metrics.remainingGlueKg || 0} kg</p><p className="rounded-lg bg-orange-50 p-2 font-bold text-orange-900">ခုတ်ဖက်: {metrics.scrapKg || 0} kg</p><p className="rounded-lg bg-rose-50 p-2 font-bold text-rose-900">Tube ပျက်: {metrics.tubeDamageKg || 0} kg</p><p className="rounded-lg bg-red-50 p-2 font-bold text-red-900">ကော်ပျက်: {metrics.glueWasteKg || 0} kg</p><p className="rounded-lg bg-slate-100 p-2 font-bold text-slate-800">ခုတ်ဖက်/ကော်စေ့: {metrics.scrapTubeCount || 0} / {metrics.scrapGlueCount || 0}</p></div></article>; })}</section> : null}
      </div>
    </main>
  );
}
