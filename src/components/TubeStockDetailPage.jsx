'use client';
import { useEffect, useState } from "react";

function number(value) { return Number(value || 0).toLocaleString(); }

export default function TubeStockDetailPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentDate, setRecentDate] = useState("");

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
            {(data?.byType || []).map((item) => <div key={item.tubeType} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3"><div><p className="font-black text-slate-900">{item.tubeType}</p><p className="text-sm font-semibold text-slate-600">{number(item.records)} ကြိမ်ထုတ်လုပ် · {number(item.packs)} အိတ်</p></div><p className="text-xl font-black text-blue-900">{number(item.pieces)} pcs</p></div>)}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-lg font-black text-slate-900">နောက်ဆုံး Tube ထုတ်လုပ်မှုမှတ်တမ်း</h2><p className="mt-1 text-xs font-semibold text-slate-500">Date မရွေးလျှင် နောက်ဆုံးမှတ်တမ်း ၃၀ ခုကို ပြပါမည်။</p></div>
            <label className="text-xs font-black text-blue-800">Date ဖြင့်ကြည့်ရန်<input type="date" value={recentDate} onChange={(event) => setRecentDate(event.target.value)} className="mt-1 block h-10 rounded-lg border border-blue-300 bg-white px-2 font-bold text-slate-800" /></label>
            {recentDate ? <button type="button" onClick={() => setRecentDate("")} className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-black text-slate-700">Date ဖျက်ရန်</button> : null}
          </div>
          <div className="mt-3 space-y-2">
            {!loading && !(data?.recent || []).length ? <p className="rounded-xl bg-slate-50 p-4 text-center font-bold text-slate-500">{recentDate ? `${recentDate} အတွက် Tube ထုတ်လုပ်မှု မရှိသေးပါ။` : "Tube ထုတ်လုပ်မှုမှတ်တမ်း မရှိသေးပါ။"}</p> : null}
            {(data?.recent || []).map((row) => <article key={row.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-slate-900">{row.reportDate} · {row.tubeType}</p><p className="font-black text-blue-900">{number(row.pieces)} pcs</p></div><p className="mt-1 text-sm font-semibold text-slate-600">{row.packs} အိတ် × {number(row.capacity)} pcs · {row.machineName}</p><p className="mt-1 text-sm font-bold text-slate-600">ပူးတွဲဆင်းသူ: {row.involvedWorkers?.length ? row.involvedWorkers.join(" · ") : "မရှိ"}</p></article>)}
          </div>
        </section>
      </div>
    </main>
  );
}
