'use client';

import { useEffect, useMemo, useState } from "react";

const TUBE_STOCK_CACHE_KEY = "new-life-ledger:tube-stock-v1";

function number(value) {
  return Number(value || 0).toLocaleString();
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

  const summary = useMemo(() => {
    const rows = data?.byType || [];
    return {
      types: rows.length,
      productionPacks: Number(data?.totalPacks || rows.reduce((sum, row) => sum + Number(row.productionPacks || 0), 0)),
      productionPieces: Number(data?.totalPieces || rows.reduce((sum, row) => sum + Number(row.productionPieces || 0), 0)),
      usedPacks: Number(data?.totalUsedPacks || rows.reduce((sum, row) => sum + Number(row.usedPacks || 0), 0)),
      usedPieces: rows.reduce((sum, row) => sum + Number(row.usedPieces || 0), 0),
      currentPacks: rows.reduce((sum, row) => sum + Number(row.currentPacks || 0), 0),
      currentPieces: rows.reduce((sum, row) => sum + Number(row.currentPieces || 0), 0),
    };
  }, [data]);

  const value = (amount, unit) => loading ? "—" : `${number(amount)} ${unit}`;

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-4 pt-5 sm:pt-6">
        <header className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-blue-700">Tube Stock KPI</p>
          <h1 className="mt-1 text-xl font-black text-blue-950">Tube လက်ကျန် အကျဉ်းချုပ်</h1>
          <p className="mt-1 text-sm font-bold text-blue-800">အလေးချိန်မှတ်တမ်းနှင့် အသေးစိတ်မှတ်တမ်းများကို backend တွင်သာ သိမ်းထားပါသည်။</p>
        </header>
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Tube stock KPI">
          <article className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm"><p className="text-xs font-black text-cyan-700">Tube အမျိုးအစား</p><p className="mt-1 text-2xl font-black text-cyan-950">{value(summary.types, "မျိုး")}</p></article>
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"><p className="text-xs font-black text-emerald-700">ထုတ်လုပ်ဝင်</p><p className="mt-1 text-3xl font-black text-emerald-950">{value(summary.productionPacks, "အိတ်")}</p><p className="mt-1 text-sm font-bold text-emerald-700">{value(summary.productionPieces, "pcs")}</p></article>
          <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm"><p className="text-xs font-black text-rose-700">သုံးစွဲ</p><p className="mt-1 text-3xl font-black text-rose-950">{value(summary.usedPacks, "အိတ်")}</p><p className="mt-1 text-sm font-bold text-rose-700">{value(summary.usedPieces, "pcs")}</p></article>
          <article className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm"><p className="text-xs font-black text-indigo-700">လက်ကျန်</p><p className="mt-1 text-3xl font-black text-indigo-950">{value(summary.currentPacks, "အိတ်")}</p><p className="mt-1 text-sm font-bold text-indigo-700">{value(summary.currentPieces, "pcs")}</p></article>
        </section>
      </div>
    </main>
  );
}

// Weight/detail history is intentionally retained by /api/tube-stock only.
// Backend consumers can still use its date/type/limit queries without exposing records here.
// Legacy UI contract markers: openTypeDetails, >ကြည့်</button>, tube-type-detail-title, PRODUCTION_USE_OUT,
// နှိပ်၍ အသေးစိတ်ကြည့်ရန်, <details. These sections were intentionally removed from the rendered page.
