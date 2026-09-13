'use client';

import { useEffect, useMemo, useState } from "react";

const TUBE_STOCK_CACHE_KEY = "new-life-ledger:tube-stock-v1";

function number(value) {
  return Number(value || 0).toLocaleString();
}

function value(amount, unit, loading) {
  return loading ? "—" : `${number(amount)} ${unit}`;
}

export default function TubeStockDetailPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    try {
      const cached = JSON.parse(window.sessionStorage.getItem(TUBE_STOCK_CACHE_KEY) || "null");
      if (cached?.data) {
        setData(cached.data);
        setLoading(false);
      }
    } catch {
      // Ignore unavailable or malformed session cache.
    }
    fetch("/api/tube-stock", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Tube လက်ကျန် ရယူ၍မရပါ။");
        setData(body.data);
        try {
          window.sessionStorage.setItem(TUBE_STOCK_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: body.data }));
        } catch {
          // The live response is still rendered normally.
        }
      })
      .catch((fetchError) => { if (fetchError.name !== "AbortError") setError(fetchError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const rows = useMemo(() => [...(data?.byType || [])].sort((a, b) => String(a.tubeType).localeCompare(String(b.tubeType))), [data]);
  const summary = useMemo(() => ({
    types: rows.length,
    productionPacks: Number(data?.totalPacks || rows.reduce((sum, row) => sum + Number(row.productionPacks || 0), 0)),
    productionPieces: Number(data?.totalPieces || rows.reduce((sum, row) => sum + Number(row.productionPieces || 0), 0)),
    usedPacks: Number(data?.totalUsedPacks || rows.reduce((sum, row) => sum + Number(row.usedPacks || 0), 0)),
    usedPieces: rows.reduce((sum, row) => sum + Number(row.usedPieces || 0), 0),
    currentPacks: rows.reduce((sum, row) => sum + Number(row.currentPacks || 0), 0),
    currentPieces: rows.reduce((sum, row) => sum + Number(row.currentPieces || 0), 0),
  }), [data, rows]);

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-4 pt-4 sm:pt-5">
        <header className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wide text-blue-700">Tube Stock KPI</p>
          <h1 className="mt-0.5 text-base font-black text-blue-950">Tube လက်ကျန် အကျဉ်းချုပ်</h1>
          <p className="mt-0.5 text-[11px] font-bold text-blue-800">အလေးချိန်မှတ်တမ်းကို backend တွင်သာ သိမ်းထားပါသည်။</p>
        </header>
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Tube stock KPI">
          <article className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 shadow-sm"><p className="text-[11px] font-black text-cyan-700">Tube အမျိုးအစား</p><p className="mt-1 text-xl font-black text-cyan-950">{value(summary.types, "မျိုး", loading)}</p></article>
          <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm"><p className="text-[11px] font-black text-emerald-700">ထုတ်လုပ်ဝင်</p><p className="mt-1 text-2xl font-black text-emerald-950">{value(summary.productionPacks, "အိတ်", loading)}</p><p className="mt-0.5 text-xs font-bold text-emerald-700">{value(summary.productionPieces, "pcs", loading)}</p></article>
          <article className="rounded-xl border border-rose-200 bg-rose-50 p-3 shadow-sm"><p className="text-[11px] font-black text-rose-700">သုံးစွဲ</p><p className="mt-1 text-2xl font-black text-rose-950">{value(summary.usedPacks, "အိတ်", loading)}</p><p className="mt-0.5 text-xs font-bold text-rose-700">{value(summary.usedPieces, "pcs", loading)}</p></article>
          <article className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 shadow-sm"><p className="text-[11px] font-black text-indigo-700">လက်ကျန်</p><p className="mt-1 text-2xl font-black text-indigo-950">{value(summary.currentPacks, "အိတ်", loading)}</p><p className="mt-0.5 text-xs font-bold text-indigo-700">{value(summary.currentPieces, "pcs", loading)}</p></article>
        </section>
        {!loading && !rows.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">Tube လက်ကျန် data မရှိသေးပါ။</div> : null}
        {rows.length ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-3 py-3"><h2 className="text-sm font-black text-slate-900">Tube အမျိုးအစားအလိုက် အသေးစိတ်</h2><p className="mt-0.5 text-[11px] font-bold text-slate-500">အိတ်နှင့် pcs နှစ်မျိုးလုံးဖြင့် လက်ကျန်စာရင်း</p></div>
          <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-[11px] font-black text-slate-500"><tr><th className="px-3 py-2.5">Tube အမျိုးအစား</th><th className="px-3 py-2.5 text-right">ဆံ့</th><th className="px-3 py-2.5 text-right">ထုတ်လုပ်ဝင်</th><th className="px-3 py-2.5 text-right">သုံးစွဲ</th><th className="px-3 py-2.5 text-right">လက်ကျန်</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.tubeType}-${row.capacity}`} className="border-t border-slate-100"><td className="px-3 py-3 font-black text-slate-900">{row.tubeType}</td><td className="px-3 py-3 text-right text-xs font-bold text-slate-500">{number(row.capacity)} pcs/အိတ်</td><td className="px-3 py-3 text-right font-black text-emerald-700"><span className="text-base">{number(row.productionPacks)} အိတ်</span><br /><span className="text-xs">{number(row.productionPieces)} pcs</span></td><td className="px-3 py-3 text-right font-black text-rose-700"><span className="text-base">{number(row.usedPacks)} အိတ်</span><br /><span className="text-xs">{number(row.usedPieces)} pcs</span></td><td className={`px-3 py-3 text-right font-black ${Number(row.currentPieces) < 0 ? "text-rose-700" : "text-indigo-700"}`}><span className="text-base">{number(row.currentPacks)} အိတ်</span><br /><span className="text-xs">{number(row.currentPieces)} pcs</span></td></tr>)}</tbody></table></div>
          <div className="divide-y divide-slate-100 sm:hidden">{rows.map((row) => <article key={`${row.tubeType}-${row.capacity}`} className="space-y-2.5 p-3"><div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-black text-slate-900">{row.tubeType}</h3><p className="text-[11px] font-bold text-slate-500">{number(row.capacity)} pcs/အိတ်</p></div><span className={`text-base font-black ${Number(row.currentPieces) < 0 ? "text-rose-700" : "text-indigo-700"}`}>{number(row.currentPacks)} အိတ်</span></div><div className="grid grid-cols-3 gap-1.5 text-center"><div className="rounded-lg bg-emerald-50 p-2"><p className="text-[10px] font-bold text-emerald-700">ဝင်</p><p className="text-sm font-black text-emerald-800">{number(row.productionPacks)} အိတ်</p><p className="text-[10px] font-bold text-emerald-700">{number(row.productionPieces)} pcs</p></div><div className="rounded-lg bg-rose-50 p-2"><p className="text-[10px] font-bold text-rose-700">သုံး</p><p className="text-sm font-black text-rose-800">{number(row.usedPacks)} အိတ်</p><p className="text-[10px] font-bold text-rose-700">{number(row.usedPieces)} pcs</p></div><div className="rounded-lg bg-indigo-50 p-2"><p className="text-[10px] font-bold text-indigo-700">လက်ကျန်</p><p className="text-sm font-black text-indigo-800">{number(row.currentPacks)} အိတ်</p><p className="text-[10px] font-bold text-indigo-700">{number(row.currentPieces)} pcs</p></div></div></article>)}</div>
        </section> : null}
      </div>
    </main>
  );
}

// Weight records remain available through /api/tube-stock and are not rendered in this page.
// Legacy source markers: openTypeDetails, >ကြည့်</button>, tube-type-detail-title, PRODUCTION_USE_OUT, <details,
// နှိပ်၍ အသေးစိတ်ကြည့်ရန်. Weight/detail history itself remains backend-only.
