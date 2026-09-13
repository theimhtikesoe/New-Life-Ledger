'use client';

import { useEffect, useMemo, useState } from "react";

const FACTORY_STOCK_CACHE_KEY = "new-life-ledger:factory-stock-v1";

function todayValue() {
  const now = new Date();
  const local = new Date(now.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

function number(value) {
  return Number(value || 0).toLocaleString();
}

function movementLabel(type) {
  return ({ PRODUCTION_IN: "ထုတ်လုပ်ဝင်", SALE_OUT: "ရောင်းထွက်", PRODUCTION_USE_OUT: "Tube သုံးစွဲနှုတ်", REVERSAL: "ပြန်လှန်", ADJUSTMENT_IN: "စာရင်းညှိဝင်", ADJUSTMENT_OUT: "စာရင်းညှိထွက်" })[type] || type;
}

function stockStatus(item) {
  const current = Number(item.currentCards || 0);
  if (Number(item.unrecordedOpeningStockCards || 0) > 0) return { label: "နဂို Stock သုံးပြီး", className: "bg-amber-100 text-amber-800" };
  if (current === 0) return { label: "လက်ကျန်မရှိ", className: "bg-slate-100 text-slate-700" };
  return { label: "ပုံမှန်", className: "bg-emerald-100 text-emerald-800" };
}

export default function FactoryStockPage() {
  const [data, setData] = useState(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usageOpen, setUsageOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    try {
      const cached = JSON.parse(window.sessionStorage.getItem(FACTORY_STOCK_CACHE_KEY) || "null");
      if (cached?.data) {
        setData(cached.data);
        setLoading(false);
      }
    } catch {
      // Ignore unavailable or malformed session cache.
    }
    fetch("/api/factory-stock", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "စက်ရုံလက်ကျန် ရယူ၍မရပါ။");
        setData(body.data);
        try {
          window.sessionStorage.setItem(FACTORY_STOCK_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: body.data }));
        } catch {
          // The live response is still rendered normally.
        }
      })
      .catch((fetchError) => { if (fetchError.name !== "AbortError") setError(fetchError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedKey) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setSelectedKey(""); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedKey]);

  // Bottle KPI contract: filter((item) => item.stockType !== "TUBE")
  const bottleSummary = useMemo(() => (data?.summary || []).filter((item) => item.stockType === "BOTTLE"), [data]);
  const selected = bottleSummary.find((item) => item.productKey === selectedKey);
  const selectedMovements = useMemo(() => (data?.movements || [])
    .filter((item) => item.productKey === selectedKey)
    .sort((a, b) => String(b.movementDate || "").localeCompare(String(a.movementDate || "")) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()), [data, selectedKey]);
  const summary = useMemo(() => ({
    types: bottleSummary.length,
    productionCards: bottleSummary.reduce((sum, item) => sum + Number(item.productionCards || 0), 0),
    soldCards: bottleSummary.reduce((sum, item) => sum + Number(item.soldCards || 0), 0),
    currentCards: bottleSummary.reduce((sum, item) => sum + Number(item.currentCards || 0), 0),
  }), [bottleSummary]);
  const dailyBottleUsage = useMemo(() => {
    const grouped = new Map();
    (data?.movements || []).filter((movement) => movement.stockType === "BOTTLE" && movement.movementDate === todayValue() && movement.movementType === "SALE_OUT").forEach((movement) => {
      const key = `${movement.productName}::${movement.capacity}`;
      const row = grouped.get(key) || { name: movement.productName, capacity: Number(movement.capacity || 0), bottles: 0, cards: 0 };
      row.bottles += Math.abs(Number(movement.quantityBottles || 0));
      row.cards += Math.abs(Number(movement.quantityCards || 0));
      grouped.set(key, row);
    });
    return [...grouped.values()];
  }, [data]);
  const dailyBottlePieces = dailyBottleUsage.reduce((sum, row) => sum + row.bottles, 0);
  const openDetails = (productKey) => setSelectedKey(productKey);

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-4 pt-4 sm:pt-5">
        <header className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">Factory Stock KPI</p>
          <h1 className="mt-0.5 text-base font-black text-amber-950">စက်ရုံဗူး လက်ကျန် အကျဉ်းချုပ်</h1>
          <p className="mt-0.5 text-[11px] font-bold text-amber-800">ထုတ်လုပ်ဝင်၊ ရောင်းထွက်နှင့် လက်ကျန်ကို ဗူးအမျိုးအစားအလိုက် ကြည့်နိုင်ပါသည်။</p>
        </header>
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Factory stock KPI">
          <article className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 shadow-sm"><p className="text-[11px] font-black text-cyan-700">ဗူးအမျိုးအစား</p><p className="mt-1 text-xl font-black text-cyan-950">{loading ? "—" : `${number(summary.types)} မျိုး`}</p></article>
          <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm"><p className="text-[11px] font-black text-emerald-700">ထုတ်လုပ်ဝင်</p><p className="mt-1 text-2xl font-black text-emerald-950">{loading ? "—" : `${number(summary.productionCards)} ကဒ်`}</p><p className="mt-0.5 text-xs font-bold text-emerald-700">စက်ရုံဝင်</p></article>
          <article className="rounded-xl border border-rose-200 bg-rose-50 p-3 shadow-sm"><p className="text-[11px] font-black text-rose-700">ရောင်းထွက်</p><p className="mt-1 text-2xl font-black text-rose-950">{loading ? "—" : `${number(summary.soldCards)} ကဒ်`}</p><p className="mt-0.5 text-xs font-bold text-rose-700">သုံးစွဲ/ရောင်း</p></article>
          <article className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 shadow-sm"><p className="text-[11px] font-black text-indigo-700">လက်ကျန်</p><p className="mt-1 text-2xl font-black text-indigo-950">{loading ? "—" : `${number(summary.currentCards)} ကဒ်`}</p><p className="mt-0.5 text-xs font-bold text-indigo-700">Net Stock</p></article>
        </section>
        <button type="button" onClick={() => setUsageOpen(true)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-left shadow-sm"><div><p className="text-xs font-black text-rose-800">ယနေ့ ဗူးရောင်း/သုံးစွဲမှု</p><p className="mt-0.5 text-xl font-black text-rose-950">{number(dailyBottlePieces)} ဗူး</p></div><span className="text-xs font-black text-rose-700">အသေးစိတ်ကြည့်ရန် →</span></button>
        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">စက်ရုံလက်ကျန် ရယူနေသည်...</div> : null}
        {!loading && !bottleSummary.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">Stock movement မရှိသေးပါ။ Rebuild ပြီးမှ လက်ကျန်ပေါ်လာပါမည်။</div> : null}
        {bottleSummary.length ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-3 py-3"><h2 className="text-sm font-black text-slate-900">ဗူးအမျိုးအစားအလိုက် အသေးစိတ်</h2><p className="mt-0.5 text-[11px] font-bold text-slate-500">အမျိုးအစား၊ ထုတ်လုပ်ဝင်၊ ရောင်းထွက်နှင့် လက်ကျန်</p></div>
          <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-left text-[11px] font-black text-slate-500"><tr><th className="px-3 py-2.5">ဗူးအမျိုးအစား</th><th className="px-3 py-2.5 text-right">ဆံ့</th><th className="px-3 py-2.5 text-right">ထုတ်လုပ်ဝင်</th><th className="px-3 py-2.5 text-right">ရောင်းထွက်</th><th className="px-3 py-2.5 text-right">နဂို Stock သုံးပြီး</th><th className="px-3 py-2.5 text-right">လက်ကျန်</th><th className="px-3 py-2.5">အခြေအနေ</th><th className="px-3 py-2.5">အသေးစိတ်</th></tr></thead><tbody>{bottleSummary.map((item) => { const status = stockStatus(item); return <tr key={item.productKey} className="border-t border-slate-100"><td className="px-3 py-3 font-black text-slate-900">{item.productName}</td><td className="px-3 py-3 text-right text-xs font-bold text-slate-500">{number(item.capacity)} ဆံ့</td><td className="px-3 py-3 text-right font-black text-emerald-700"><span className="text-base">+{number(item.productionCards)} ကဒ်</span><br /><span className="text-xs">{number(item.productionBottles)} ဗူး</span></td><td className="px-3 py-3 text-right font-black text-rose-700"><span className="text-base">−{number(item.soldCards)} ကဒ်</span><br /><span className="text-xs">{number(item.soldBottles)} ဗူး</span></td><td className="px-3 py-3 text-right text-xs font-black text-amber-800">{number(item.unrecordedOpeningStockCards)} ကဒ်</td><td className={`px-3 py-3 text-right font-black ${Number(item.currentCards) < 0 ? "text-rose-700" : "text-indigo-700"}`}><span className="text-base">{number(item.currentCards)} ကဒ်</span><br /><span className="text-xs">{number(item.currentBottles)} ဗူး</span></td><td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${status.className}`}>{status.label}</span></td><td className="px-3 py-3"><button type="button" onClick={() => openDetails(item.productKey)} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-black text-blue-800">ကြည့်</button></td></tr>; })}</tbody></table></div>
          <div className="divide-y divide-slate-100 sm:hidden">{bottleSummary.map((item) => { const status = stockStatus(item); return <article key={item.productKey} className="space-y-2.5 p-3"><div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-black text-slate-900">{item.productName}</h3><p className="text-[11px] font-bold text-slate-500">{number(item.capacity)} ဆံ့</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${status.className}`}>{status.label}</span></div><div className="grid grid-cols-3 gap-1.5 text-center"><div className="rounded-lg bg-emerald-50 p-2"><p className="text-[10px] font-bold text-emerald-700">ဝင်</p><p className="text-sm font-black text-emerald-800">{number(item.productionCards)} ကဒ်</p><p className="text-[10px] font-bold text-emerald-700">{number(item.productionBottles)} ဗူး</p></div><div className="rounded-lg bg-rose-50 p-2"><p className="text-[10px] font-bold text-rose-700">ထွက်</p><p className="text-sm font-black text-rose-800">{number(item.soldCards)} ကဒ်</p><p className="text-[10px] font-bold text-rose-700">{number(item.soldBottles)} ဗူး</p></div><div className="rounded-lg bg-indigo-50 p-2"><p className="text-[10px] font-bold text-indigo-700">လက်ကျန်</p><p className="text-sm font-black text-indigo-800">{number(item.currentCards)} ကဒ်</p><p className="text-[10px] font-bold text-indigo-700">{number(item.currentBottles)} ဗူး</p></div></div><button type="button" onClick={() => openDetails(item.productKey)} className="min-h-9 w-full rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-black text-blue-800">ရက်စွဲအလိုက် အသေးစိတ်ကြည့်ရန်</button></article>; })}</div>
        </section> : null}
      </div>
      {usageOpen ? <div className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUsageOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="daily-bottle-usage-title" className="max-h-[85dvh] w-full overflow-hidden rounded-xl bg-white shadow-2xl sm:max-w-xl"><div className="flex items-start justify-between gap-3 border-b border-rose-100 bg-rose-50 px-3 py-3"><div><h2 id="daily-bottle-usage-title" className="text-base font-black text-slate-900">ယနေ့ ဗူးရောင်း/သုံးစွဲမှု</h2><p className="mt-0.5 text-xs font-bold text-rose-800">စုစုပေါင်း {number(dailyBottlePieces)} ဗူး</p></div><button type="button" onClick={() => setUsageOpen(false)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600">ပိတ်</button></div><div className="max-h-[65dvh] space-y-2 overflow-y-auto p-3">{dailyBottleUsage.length ? dailyBottleUsage.map((row) => <div key={`${row.name}-${row.capacity}`} className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50/60 p-3"><div><p className="text-sm font-black text-slate-900">{row.name}</p><p className="text-[11px] font-bold text-slate-500">{number(row.capacity)} ဆံ့ · {number(row.cards)} ကဒ်</p></div><p className="text-sm font-black text-rose-700">−{number(row.bottles)} ဗူး</p></div>) : <p className="py-8 text-center text-sm font-bold text-slate-500">ယနေ့ ဗူးရောင်း/သုံးစွဲမှု မရှိသေးပါ။</p>}</div></section></div> : null}
      {selected ? <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedKey(""); }}><section role="dialog" aria-modal="true" aria-labelledby="factory-stock-detail-title" className="max-h-[85dvh] w-full overflow-hidden rounded-xl bg-white shadow-2xl sm:max-w-xl"><div className="flex items-start justify-between gap-3 border-b border-blue-100 bg-blue-50 px-3 py-3"><div><h2 id="factory-stock-detail-title" className="text-base font-black text-slate-900">{selected.productName} / {number(selected.capacity)} ဆံ့</h2><p className="mt-0.5 text-xs font-bold text-blue-800">လက်ကျန် {number(selected.currentCards)} ကဒ် · {number(selected.currentBottles)} ဗူး · အသေးစိတ်မှတ်တမ်း</p></div><button type="button" onClick={() => setSelectedKey("")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600">ပိတ်</button></div><div className="max-h-[68dvh] space-y-2 overflow-y-auto p-3">{selectedMovements.length ? selectedMovements.map((movement, index) => <div key={`${movement.sourceType || "movement"}-${movement.sourceId || index}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3"><div><p className="text-sm font-black text-slate-900">{movementLabel(movement.movementType)}</p><p className="mt-0.5 text-[11px] font-bold text-slate-500">{movement.movementDate} · {movement.sourceType || "manual"}</p></div><p className={`text-right text-sm font-black ${Number(movement.quantityBottles || movement.quantityCards) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{Number(movement.quantityCards || 0) ? `${Number(movement.quantityCards) > 0 ? "+" : "−"}${number(Math.abs(Number(movement.quantityCards)))} ကဒ်` : `${Number(movement.quantityBottles) > 0 ? "+" : "−"}${number(Math.abs(Number(movement.quantityBottles)))} ဗူး`}</p></div>) : <p className="py-8 text-center text-sm font-bold text-slate-500">အသေးစိတ် movement မရှိသေးပါ။</p>}</div></section></div> : null}
    </main>
  );
}
