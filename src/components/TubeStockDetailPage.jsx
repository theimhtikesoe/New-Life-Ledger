'use client';
import { useEffect, useState } from "react";

const TUBE_STOCK_CACHE_KEY = "new-life-ledger:tube-stock-v2";

function number(value) { return Number(value || 0).toLocaleString(); }

function tubeSize(value) {
  const match = String(value || "").match(/^(\d+(?:\.\d+)?)g/i);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function stockStatus(item) {
  if (Number(item.unrecordedOpeningPieces || 0) > 0) return { label: "မထည့်ရသေးသော နဂို Tube သုံးပြီး", className: "bg-amber-100 text-amber-800" };
  if (Number(item.currentPieces || 0) < 0) return { label: "အနုတ်လက်ကျန်", className: "bg-rose-100 text-rose-800" };
  if (Number(item.currentPieces || 0) === 0) return { label: "လက်ကျန်မရှိ", className: "bg-slate-100 text-slate-700" };
  return { label: "ပုံမှန်", className: "bg-emerald-100 text-emerald-800" };
}

function movementLabel(type) {
  return ({
    PRODUCTION_IN: "ထုတ်လုပ်မှုဝင်",
    PRODUCTION_USE_OUT: "Tube သုံးစွဲ",
    PRODUCTION_WASTE_OUT: "ပျက်စီးမှုနုတ်",
    ADJUSTMENT_IN: "စာရင်းညှိဝင်",
    ADJUSTMENT_OUT: "စာရင်းညှိထွက်",
    REVERSAL: "ပြန်လှန်",
  })[type] || type;
}

export default function TubeStockDetailPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailMovements, setDetailMovements] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);

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

  const sortedByType = [...(data?.byType || [])].sort((left, right) => {
    const sizeDifference = tubeSize(left.tubeType) - tubeSize(right.tubeType);
    return sizeDifference || String(left.tubeType).localeCompare(String(right.tubeType));
  });

  const dailyTubeUsage = data?.dailyUsage || [];
  const dailyTubePieces = dailyTubeUsage.reduce((sum, row) => sum + Number(row.pieces || 0), 0);

  async function openTypeDetails(item) {
    setSelectedType(item.tubeType);
    setSelectedItem(item);
    setDetailMovements([]);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/tube-stock?type=${encodeURIComponent(item.tubeType)}&limit=100`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Tube အသေးစိတ် ရယူ၍မရပါ။");
      setDetailMovements(body.data?.movements || []);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-4 pt-5 sm:pt-6">
        <button type="button" onClick={() => setUsageOpen(true)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left shadow-sm"><div><p className="text-sm font-black text-rose-800">ယနေ့ Tube သုံးစွဲမှု</p><p className="mt-1 text-2xl font-black text-rose-950">{number(dailyTubePieces)} pcs</p></div><span className="text-sm font-black text-rose-700">အသေးစိတ်ကြည့်ရန် →</span></button>
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">Tube လက်ကျန် ရယူနေသည်...</div> : null}
        {!loading && !data?.byType?.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center font-bold text-slate-500">Tube လက်ကျန် data မရှိသေးပါ။</div> : null}
        {!loading && data?.byType?.length ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[1120px] text-sm"><thead className="bg-slate-50 text-left text-xs font-black text-slate-500"><tr><th className="px-4 py-3">Tube အမျိုးအစား</th><th className="px-4 py-3 text-right">ဆံ့</th><th className="px-4 py-3 text-right">ထုတ်လုပ်ဝင်</th><th className="px-4 py-3 text-right">သုံးစွဲ</th><th className="px-4 py-3 text-right">စာရင်းညှိ</th><th className="px-4 py-3 text-right">မထည့်ရသေးသော နဂို Tube သုံးပြီး</th><th className="px-4 py-3 text-right">Net Stock Change</th><th className="px-4 py-3">အခြေအနေ</th><th className="px-4 py-3">အသေးစိတ်</th></tr></thead><tbody>{sortedByType.map((item) => { const status = stockStatus(item); return <tr key={item.tubeType} className="border-t border-slate-100"><td className="px-4 py-3 font-black text-slate-900">{item.tubeType}</td><td className="px-4 py-3 text-right font-bold text-slate-600">{number(item.capacity)} pcs / အိတ်</td><td className="px-4 py-3 text-right font-black text-emerald-700">+{number(item.productionPacks)} အိတ် <span className="text-xs">({number(item.productionPieces)} pcs)</span></td><td className="px-4 py-3 text-right font-black text-rose-700">-{number(item.usedPieces)} pcs</td><td className="px-4 py-3 text-right font-black text-amber-700">{item.adjustmentPieces > 0 ? "+" : ""}{number(item.adjustmentPieces)} pcs</td><td className="px-4 py-3 text-right font-black text-amber-800">{number(item.unrecordedOpeningPieces)} pcs</td><td className={`px-4 py-3 text-right text-base font-black ${item.currentPieces < 0 ? "text-rose-700" : "text-slate-900"}`}>{number(item.currentPacks)} အိတ် <span className="text-xs">({number(item.currentPieces)} pcs)</span></td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-black ${status.className}`}>{status.label}</span></td><td className="px-4 py-3"><button type="button" onClick={() => openTypeDetails(item)} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 hover:bg-blue-100">ကြည့်</button></td></tr>; })}</tbody></table></div>
          <div className="divide-y divide-slate-100 sm:hidden">{sortedByType.map((item) => { const status = stockStatus(item); return <article key={item.tubeType} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-900">{item.tubeType}</h2><p className="text-xs font-bold text-slate-500">{number(item.capacity)} pcs / အိတ်</p></div><span className={`rounded-full px-2 py-1 text-xs font-black ${status.className}`}>{status.label}</span></div><div className="grid grid-cols-2 gap-2 text-sm"><p className="rounded-lg bg-emerald-50 p-2 font-bold text-emerald-800">ဝင် +{number(item.productionPacks)} အိတ်<br /><span className="text-xs">{number(item.productionPieces)} pcs</span></p><p className="rounded-lg bg-rose-50 p-2 font-bold text-rose-800">သုံး -{number(item.usedPieces)} pcs</p><p className="rounded-lg bg-amber-50 p-2 font-bold text-amber-800">မထည့်ရသေးသော နဂို Tube သုံးပြီး {number(item.unrecordedOpeningPieces)} pcs</p><p className={`rounded-lg bg-slate-100 p-2 font-black ${item.currentPieces < 0 ? "text-rose-700" : "text-slate-900"}`}>Net Stock Change {number(item.currentPacks)} အိတ်<br /><span className="text-xs">({number(item.currentPieces)} pcs)</span></p></div><button type="button" onClick={() => openTypeDetails(item)} className="min-h-10 w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-black text-blue-800">ကြည့်</button></article>; })}</div>
        </section> : null}
      </div>
      {usageOpen ? <div className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUsageOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="daily-tube-usage-title" className="max-h-[85dvh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-w-xl"><div className="flex items-start justify-between gap-3 border-b border-rose-100 bg-rose-50 px-4 py-4"><div><h2 id="daily-tube-usage-title" className="text-lg font-black text-slate-900">ယနေ့ Tube သုံးစွဲမှု</h2><p className="mt-1 text-sm font-bold text-rose-800">စုစုပေါင်း {number(dailyTubePieces)} pcs</p></div><button type="button" onClick={() => setUsageOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">ပိတ်</button></div><div className="max-h-[65dvh] space-y-2 overflow-y-auto p-4">{dailyTubeUsage.length ? dailyTubeUsage.map((row) => <div key={`${row.tubeType}-${row.capacity}`} className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50/60 p-3"><div><p className="font-black text-slate-900">{row.tubeType}</p><p className="text-xs font-bold text-slate-500">{number(row.capacity)} pcs / အိတ်</p></div><p className="text-base font-black text-rose-700">-{number(row.pieces)} pcs</p></div>) : <p className="py-8 text-center font-bold text-slate-500">ယနေ့ Tube သုံးစွဲမှု မရှိသေးပါ။</p>}</div></section></div> : null}
      {selectedType ? <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setSelectedType(""); setSelectedItem(null); } }}><section role="dialog" aria-modal="true" aria-labelledby="tube-type-detail-title" className="max-h-[85dvh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl"><div className="flex items-start justify-between gap-3 border-b border-blue-100 bg-blue-50 px-4 py-4"><div><h2 id="tube-type-detail-title" className="text-lg font-black text-slate-900">{selectedType} / {number(selectedItem?.capacity)} ဆံ့</h2><p className="mt-1 text-sm font-black text-blue-800">Net Stock Change {number(selectedItem?.currentPacks)} အိတ် ({number(selectedItem?.currentPieces)} pcs) · အသေးစိတ်မှတ်တမ်း</p>{Number(selectedItem?.currentPieces || 0) < 0 ? <p className="mt-1 text-xs font-bold text-rose-700">မထည့်ရသေးသော နဂို Tube Stock ထဲက အသုံးပြုပြီးသား လိုအပ်ချက်ပမာဏကို ပြထားခြင်းဖြစ်သည်။</p> : null}</div><button type="button" onClick={() => { setSelectedType(""); setSelectedItem(null); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">ပိတ်</button></div><div className="max-h-[65dvh] space-y-2 overflow-y-auto p-4">{detailLoading ? <p className="py-8 text-center font-bold text-slate-500">အသေးစိတ် ရယူနေသည်...</p> : detailMovements.filter((movement) => ["PRODUCTION_IN", "PRODUCTION_USE_OUT", "PRODUCTION_WASTE_OUT"].includes(movement.movementType)).length ? detailMovements.filter((movement) => ["PRODUCTION_IN", "PRODUCTION_USE_OUT", "PRODUCTION_WASTE_OUT"].includes(movement.movementType)).map((movement, index) => { const isOut = Number(movement.quantityBottles || movement.quantityCards || 0) < 0; return <article key={`${movement.sourceType || "movement"}-${movement.movementDate}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><div><p className="font-black text-slate-900">{movementLabel(movement.movementType)}</p><p className="text-xs text-slate-500">{movement.movementDate} · {movement.sourceType || "manual"}</p></div><p className={`text-base font-black ${isOut ? "text-rose-700" : "text-emerald-700"}`}>{isOut ? "" : "+"}{number(movement.quantityBottles || movement.quantityCards)} pcs</p></article>; }) : <p className="py-8 text-center font-bold text-slate-500">မှတ်တမ်းမရှိသေးပါ။</p>}</div></section></div> : null}
    </main>
  );
}
