'use client';

import { useEffect, useState } from "react";

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
  return ({ PRODUCTION_IN: "ထုတ်လုပ်မှုဝင်", SALE_OUT: "ရောင်းထွက်", PRODUCTION_USE_OUT: "Tube သုံးစွဲနှုတ်", REVERSAL: "ပြန်လှန်", ADJUSTMENT_IN: "စာရင်းညှိဝင်", ADJUSTMENT_OUT: "စာရင်းညှိထွက်" })[type] || type;
}

function stockStatus(item) {
  const current = item.stockType === "TUBE" ? Number(item.currentBottles || 0) : Number(item.currentCards || 0);
  if (Number(item.openingStockCards || item.openingStockBottles || 0) > 0) return { label: "နဂို Stock ဖြင့်ညှိရန်", className: "bg-amber-100 text-amber-800" };
  if (current === 0) return { label: "လက်ကျန်မရှိ", className: "bg-slate-100 text-slate-700" };
  return { label: "ပုံမှန်", className: "bg-emerald-100 text-emerald-800" };
}

export default function FactoryStockPage() {
  const [data, setData] = useState(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    setError("");
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

  const bottleSummary = (data?.summary || []).filter((item) => item.stockType !== "TUBE");
  const selected = bottleSummary.find((item) => item.productKey === selectedKey);
  const selectedMovements = data?.movements?.filter((item) => item.productKey === selectedKey) || [];
  const openDetails = (productKey) => setSelectedKey(productKey);

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-4 pt-5 sm:pt-6">
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">စက်ရုံလက်ကျန် ရယူနေသည်...</div> : null}
        {!loading && !bottleSummary.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center font-bold text-slate-500">Stock movement မရှိသေးပါ။ Rebuild ပြီးမှ လက်ကျန်ပေါ်လာပါမည်။</div> : null}
        {!loading && bottleSummary.length ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[800px] text-sm"><thead className="bg-slate-50 text-left text-xs font-black text-slate-500"><tr><th className="px-4 py-3">ဗူးအမျိုးအစား</th><th className="px-4 py-3 text-right">ဆံ့</th><th className="px-4 py-3 text-right">ထုတ်လုပ်ဝင်</th><th className="px-4 py-3 text-right">သုံးစွဲ/ရောင်းထွက်</th><th className="px-4 py-3 text-right">နဂိုရှိ Stock</th><th className="px-4 py-3 text-right">လက်ကျန်</th><th className="px-4 py-3">အခြေအနေ</th><th className="px-4 py-3">အသေးစိတ်</th></tr></thead><tbody>{bottleSummary.map((item) => { const status = stockStatus(item); return <tr key={item.productKey} className="border-t border-slate-100"><td className="px-4 py-3 font-black text-slate-900">{item.productName}</td><td className="px-4 py-3 text-right font-bold text-slate-600">{number(item.capacity)}</td><td className="px-4 py-3 text-right font-black text-emerald-700">+{number(item.productionCards)} {item.stockType === "TUBE" ? `အိတ် / ${number(item.productionBottles)} pcs` : "ကဒ်"}</td><td className="px-4 py-3 text-right font-black text-rose-700">-{number(item.stockType === "TUBE" ? item.usedBottles : item.soldCards)} {item.stockType === "TUBE" ? "pcs သုံး" : "ကဒ်ရောင်း"}</td><td className="px-4 py-3 text-right font-black text-amber-800">{number(item.stockType === "TUBE" ? item.openingStockBottles : item.openingStockCards)} {item.stockType === "TUBE" ? "pcs" : "ကဒ်"}</td><td className={`px-4 py-3 text-right text-base font-black ${(item.stockType === "TUBE" ? item.currentBottles : item.currentCards) < 0 ? "text-rose-700" : "text-slate-900"}`}>{number(item.stockType === "TUBE" ? item.currentBottles : item.currentCards)} {item.stockType === "TUBE" ? "pcs" : "ကဒ်"}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-black ${status.className}`}>{status.label}</span></td><td className="px-4 py-3"><button type="button" onClick={() => openDetails(item.productKey)} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800">ကြည့်</button></td></tr>; })}</tbody></table></div>
          <div className="divide-y divide-slate-100 sm:hidden">{bottleSummary.map((item) => { const status = stockStatus(item); return <article key={item.productKey} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-900">{item.productName}</h2><p className="text-xs font-bold text-slate-500">{number(item.capacity)} ဆံ့</p></div><span className={`rounded-full px-2 py-1 text-xs font-black ${status.className}`}>{status.label}</span></div><div className="grid grid-cols-2 gap-2 text-sm"><p className="rounded-lg bg-emerald-50 p-2 font-bold text-emerald-800">ဝင် +{number(item.productionCards)} {item.stockType === "TUBE" ? `အိတ် / ${number(item.productionBottles)} pcs` : "ကဒ်"}</p><p className="rounded-lg bg-rose-50 p-2 font-bold text-rose-800">{item.stockType === "TUBE" ? `သုံး -${number(item.usedBottles)} pcs` : `ထွက် -${number(item.soldCards)} ကဒ်`}</p><p className="rounded-lg bg-orange-50 p-2 font-bold text-orange-800">နဂိုရှိ Stock {number(item.stockType === "TUBE" ? item.openingStockBottles : item.openingStockCards)} {item.stockType === "TUBE" ? "pcs" : "ကဒ်"}</p><p className="rounded-lg bg-slate-100 p-2 font-black text-slate-900">လက်ကျန် {number(item.stockType === "TUBE" ? item.currentBottles : item.currentCards)} {item.stockType === "TUBE" ? "pcs" : "ကဒ်"}</p></div><button type="button" onClick={() => openDetails(item.productKey)} className="min-h-10 w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-black text-orange-800">ကြည့်</button></article>; })}</div>
        </section> : null}
      </div>
      {selected ? <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedKey(""); }}><section role="dialog" aria-modal="true" aria-labelledby="factory-stock-detail-title" className="max-h-[85dvh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl"><div className="flex items-start justify-between gap-3 border-b border-orange-100 bg-orange-50 px-4 py-4"><div><h2 id="factory-stock-detail-title" className="text-lg font-black text-slate-900">{selected.productName} / {number(selected.capacity)} ဆံ့</h2><p className="mt-1 text-sm font-black text-orange-800">လက်ကျန် {number(selected.stockType === "TUBE" ? selected.currentBottles : selected.currentCards)} {selected.stockType === "TUBE" ? "pcs" : "ကဒ်"} · အသေးစိတ်မှတ်တမ်း</p></div><button type="button" onClick={() => setSelectedKey("")} aria-label="အသေးစိတ်ပိတ်ရန်" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">ပိတ်</button></div><div className="max-h-[65dvh] space-y-2 overflow-y-auto p-4">{selectedMovements.length ? selectedMovements.map((movement, index) => <div key={`${movement.sourceType || "movement"}-${movement.sourceId || index}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><div><p className="font-black text-slate-900">{movementLabel(movement.movementType)}</p><p className="text-xs text-slate-500">{movement.movementDate} · {movement.sourceType || "manual"}</p></div><p className={`text-base font-black ${movement.quantityBottles < 0 || movement.quantityCards < 0 ? "text-rose-700" : "text-emerald-700"}`}>{movement.stockType === "TUBE" ? `${movement.quantityBottles > 0 ? "+" : ""}${number(movement.quantityBottles)} pcs` : `${movement.quantityCards > 0 ? "+" : ""}${number(movement.quantityCards)} ကဒ်`}</p></div>) : <p className="py-8 text-center font-bold text-slate-500">အသေးစိတ် movement မရှိသေးပါ။</p>}</div></section></div> : null}
    </main>
  );
}
