'use client';
import { useEffect, useState } from "react";

function number(value) { return Number(value || 0).toLocaleString(); }

export default function TubeStockDetailPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentDate, setRecentDate] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [detailRows, setDetailRows] = useState([]);
  const [detailMovements, setDetailMovements] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = recentDate ? `?date=${encodeURIComponent(recentDate)}` : "";
    fetch(`/api/tube-stock${query}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Tube လက်ကျန် ရယူ၍မရပါ။");
        setData(body.data);
      })
      .catch((fetchError) => { if (fetchError.name !== "AbortError") setError(fetchError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [recentDate]);

  async function openTypeDetails(item) {
    setSelectedType(item.tubeType);
    setDetailRows([]);
    setDetailMovements([]);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/tube-stock?type=${encodeURIComponent(item.tubeType)}&limit=100`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Tube အသေးစိတ် ရယူ၍မရပါ။");
      setDetailRows(body.data?.recent || []);
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
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm"><p className="text-xs font-black text-blue-700">လက်ကျန် Tube</p><p className="mt-1 text-2xl font-black text-blue-950">{loading ? "ရယူနေသည်..." : `${number(data?.totalPieces)} pcs`}</p></div>
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm"><p className="text-xs font-black text-cyan-700">အိတ်အရေအတွက်</p><p className="mt-1 text-2xl font-black text-cyan-950">{loading ? "ရယူနေသည်..." : `${number(data?.totalPacks)} အိတ်`}</p></div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm"><p className="text-xs font-black text-indigo-700">ထုတ်လုပ်မှုမှတ်တမ်း</p><p className="mt-1 text-2xl font-black text-indigo-950">{loading ? "ရယူနေသည်..." : `${number(data?.records)} ကြိမ်`}</p></div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-slate-900">Tube အမျိုးအစားအလိုက် လက်ကျန်</h2>
          <div className="mt-3 space-y-2">
            {!loading && !data?.byType?.length ? <p className="rounded-xl bg-slate-50 p-4 text-center font-bold text-slate-500">Tube လက်ကျန် data မရှိသေးပါ။</p> : null}
            {(data?.byType || []).map((item) => <div key={item.tubeType} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3"><div><p className="font-black text-slate-900">{item.tubeType}</p><p className="text-sm font-semibold text-slate-600">{number(item.records)} ကြိမ်ထုတ်လုပ် · {number(item.packs)} အိတ်</p></div><div className="flex items-center gap-3"><p className="text-xl font-black text-blue-900">{number(item.pieces)} pcs</p><button type="button" onClick={() => openTypeDetails(item)} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-black text-blue-800 hover:bg-blue-100">ကြည့်</button></div></div>)}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-lg font-black text-slate-900">နောက်ဆုံး Tube ထုတ်လုပ်မှုမှတ်တမ်း</h2><p className="mt-1 text-xs font-semibold text-slate-500">Date မရွေးလျှင် နောက်ဆုံးမှတ်တမ်း ၃၀ ခုကို ပြပါမည်။</p></div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs font-black leading-5 text-blue-800"><span>Date ဖြင့်ကြည့်ရန်</span><input type="date" value={recentDate} onChange={(event) => setRecentDate(event.target.value)} className="block h-11 min-w-[145px] rounded-lg border border-blue-300 bg-white px-3 text-sm font-bold leading-normal text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /></label>
              {recentDate ? <button type="button" onClick={() => setRecentDate("")} className="h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-black text-slate-700">Date ဖျက်ရန်</button> : null}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {!loading && !(data?.recent || []).length ? <p className="rounded-xl bg-slate-50 p-4 text-center font-bold text-slate-500">{recentDate ? `${recentDate} အတွက် Tube ထုတ်လုပ်မှု မရှိသေးပါ။` : "Tube ထုတ်လုပ်မှုမှတ်တမ်း မရှိသေးပါ။"}</p> : null}
            {(data?.recent || []).map((row) => <article key={row.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-slate-900">{row.reportDate} · {row.tubeType}</p><p className="font-black text-blue-900">{number(row.pieces)} pcs</p></div><p className="mt-1 text-sm font-semibold text-slate-600">{row.packs} အိတ် × {number(row.capacity)} pcs · {row.machineName}</p><p className="mt-1 text-sm font-bold text-slate-600">ပူးတွဲဆင်းသူ: {row.involvedWorkers?.length ? row.involvedWorkers.join(" · ") : "မရှိ"}</p></article>)}
          </div>
        </section>
      </div>
      {selectedType ? <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedType(""); }}><section role="dialog" aria-modal="true" aria-labelledby="tube-type-detail-title" className="max-h-[85dvh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl"><div className="flex items-start justify-between gap-3 border-b border-blue-100 bg-blue-50 px-4 py-4"><div><h2 id="tube-type-detail-title" className="text-lg font-black text-slate-900">{selectedType} အသေးစိတ်</h2><p className="mt-1 text-sm font-black text-blue-800">ထုတ်လုပ်မှုမှတ်တမ်း</p></div><button type="button" onClick={() => setSelectedType("")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">ပိတ်</button></div><div className="max-h-[65dvh] space-y-2 overflow-y-auto p-4">{detailLoading ? <p className="py-8 text-center font-bold text-slate-500">အသေးစိတ် ရယူနေသည်...</p> : detailMovements.length ? detailMovements.map((movement, index) => { const isOut = Number(movement.quantityBottles || movement.quantityCards || 0) < 0; const label = ({ PRODUCTION_IN: "ထုတ်လုပ်မှုဝင်", PRODUCTION_USE_OUT: "Tube သုံးစွဲနှုတ်", SALE_OUT: "ရောင်းထွက်", ADJUSTMENT_IN: "စာရင်းညှိဝင်", ADJUSTMENT_OUT: "စာရင်းညှိထွက်", REVERSAL: "ပြန်လှန်" })[movement.movementType] || movement.movementType; return <article key={`${movement.sourceType || "movement"}-${movement.movementDate}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><div><p className="font-black text-slate-900">{label}</p><p className="text-xs text-slate-500">{movement.movementDate} · {movement.sourceType || "manual"}</p>{movement.note ? <p className="mt-1 text-xs font-semibold text-slate-600">{movement.note}</p> : null}</div><p className={`text-base font-black ${isOut ? "text-rose-700" : "text-emerald-700"}`}>{isOut ? "" : "+"}{number(movement.quantityBottles || movement.quantityCards)} pcs</p></article>}) : <p className="py-8 text-center font-bold text-slate-500">မှတ်တမ်းမရှိသေးပါ။</p>}</div></section></div> : null}
    </main>
  );
}
