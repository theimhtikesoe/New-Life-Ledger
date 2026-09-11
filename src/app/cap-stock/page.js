'use client';

import { useEffect, useMemo, useState } from "react";

function number(value) { return Number(value || 0).toLocaleString(); }
function movementLabel(type) {
  return ({ SALE_OUT: "ရောင်းထွက် / ဗူးတွင်သုံး", ADJUSTMENT_IN: "စာရင်းညှိဝင်", ADJUSTMENT_OUT: "စာရင်းညှိထွက်", REVERSAL: "ပြန်လှန်" })[type] || type;
}

export default function CapStockPage() {
  const [data, setData] = useState(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/factory-stock?stockType=CAP&capRefresh=${Date.now()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "အဖုံးလက်ကျန် ရယူ၍မရပါ။");
        setData(body.data);
      })
      .catch((fetchError) => { if (fetchError.name !== "AbortError") setError(fetchError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const caps = useMemo(() => (data?.summary || []).filter((item) => item.stockType === "CAP"), [data]);
  const selected = caps.find((item) => item.productKey === selectedKey);
  const selectedMovements = (data?.movements || []).filter((item) => item.productKey === selectedKey);
  const total = caps.reduce((sum, item) => sum + Number(item.currentCards || 0), 0);

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-4 pt-5 sm:pt-6">
        <section className="rounded-2xl border border-pink-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-sm font-bold text-pink-700">အဖုံးအရောင်အလိုက် စက်ရုံလက်ကျန်</p><p className="mt-1 text-xs text-slate-500">ဗူးရောင်းတိုင်း ပုံမှန်အဖုံးနှင့် အပိုအဖုံးကို အရောင်အလိုက် အလိုအလျောက်နုတ်တွက်ထားသည်။</p></div>
            <div className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-right"><p className="text-xs font-bold text-pink-700">စုစုပေါင်း အဖုံး Net Stock Change</p><p className="mt-1 text-xl font-black text-pink-950">{number(total)} ဖုံး</p></div>
          </div>
        </section>
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</div> : null}
        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">အဖုံးလက်ကျန် ရယူနေသည်...</div> : null}
        {!loading && !caps.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center font-bold text-slate-500">အဖုံး stock movement မရှိသေးပါ။</div> : null}
        {!loading && caps.length ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-pink-50 text-left text-xs font-black text-pink-900"><tr><th className="px-4 py-3">အဖုံးအရောင်</th><th className="px-4 py-3 text-right">ရောင်း/သုံးထွက်</th><th className="px-4 py-3 text-right">စာရင်းညှိ</th><th className="px-4 py-3 text-right">Net Stock Change</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{caps.map((item) => <tr key={item.productKey}><td className="px-4 py-3 font-black text-slate-900">{item.productName}</td><td className="px-4 py-3 text-right font-bold text-rose-700">-{number(item.soldCards)} ဖုံး</td><td className="px-4 py-3 text-right font-bold text-slate-700">{number(item.adjustmentCards)} ဖုံး</td><td className={`px-4 py-3 text-right text-base font-black ${Number(item.currentCards || 0) < 0 ? "text-rose-700" : "text-slate-900"}`}>{number(item.currentCards)} ဖုံး</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => setSelectedKey(item.productKey)} className="rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 text-xs font-black text-pink-800">အသေးစိတ်</button></td></tr>)}</tbody></table></div></section> : null}
        {selected ? <section className="rounded-2xl border border-pink-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">{selected.productName} အသေးစိတ်</h2><p className="text-sm font-bold text-pink-800">လက်ရှိ {number(selected.currentCards)} ဖုံး</p></div><button type="button" onClick={() => setSelectedKey("")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">ပိတ်</button></div><div className="mt-4 space-y-2">{selectedMovements.length ? selectedMovements.map((movement, index) => <div key={`${movement.sourceId || "movement"}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><div><p className="font-black text-slate-900">{movementLabel(movement.movementType)}</p><p className="text-xs text-slate-500">{movement.movementDate} · {movement.sourceType || "manual"}{movement.note ? ` · ${movement.note}` : ""}</p></div><p className={`font-black ${Number(movement.quantityCards) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{Number(movement.quantityCards) > 0 ? "+" : ""}{number(movement.quantityCards)} ဖုံး</p></div>) : <p className="py-5 text-center text-sm font-bold text-slate-500">Movement မရှိသေးပါ။</p>}</div></section> : null}
      </div>
    </main>
  );
}
