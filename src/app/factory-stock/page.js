'use client';

import { useEffect, useState } from "react";

function todayValue() {
  const now = new Date();
  const local = new Date(now.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

function number(value) {
  return Number(value || 0).toLocaleString();
}

function movementLabel(type) {
  return ({ PRODUCTION_IN: "ထုတ်လုပ်မှုဝင်", SALE_OUT: "ရောင်းထွက်", REVERSAL: "ပြန်လှန်", ADJUSTMENT_IN: "စာရင်းညှိဝင်", ADJUSTMENT_OUT: "စာရင်းညှိထွက်" })[type] || type;
}

export default function FactoryStockPage() {
  const [data, setData] = useState(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/factory-stock", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "စက်ရုံလက်ကျန် ရယူ၍မရပါ။");
        setData(body.data);
      })
      .catch((fetchError) => { if (fetchError.name !== "AbortError") setError(fetchError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const selected = data?.summary?.find((item) => item.productKey === selectedKey);
  const selectedMovements = data?.movements?.filter((item) => item.productKey === selectedKey) || [];

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-4 pt-5 sm:pt-6">
        <section className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Factory Inventory</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">စက်ရုံ ဗူးကဒ်လက်ကျန်</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">ထုတ်လုပ်မှုတိုးခြင်းနှင့် ဗူးရောင်းစာရင်းလျော့ခြင်းကို အခြေခံ၍ Database မှတွက်ထားသော လက်ကျန်ဖြစ်ပါသည်။</p>
        </section>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">{data?.warnings?.[0] || "ဤလက်ကျန်သည် Database-derived System Stock ဖြစ်ပါသည်။"}</div>
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">စက်ရုံလက်ကျန် ရယူနေသည်...</div> : null}
        {!loading && !data?.summary?.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center font-bold text-slate-500">Stock movement မရှိသေးပါ။ Rebuild ပြီးမှ လက်ကျန်ပေါ်လာပါမည်။</div> : null}
        {!loading && data?.summary?.length ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs font-black text-slate-500"><tr><th className="px-4 py-3">ဗူးအမျိုးအစား</th><th className="px-4 py-3 text-right">ဆံ့</th><th className="px-4 py-3 text-right">ထုတ်လုပ်ဝင်</th><th className="px-4 py-3 text-right">ရောင်းထွက်</th><th className="px-4 py-3 text-right">လက်ကျန်</th><th className="px-4 py-3">အသေးစိတ်</th></tr></thead><tbody>{data.summary.map((item) => <tr key={item.productKey} className="border-t border-slate-100"><td className="px-4 py-3 font-black text-slate-900">{item.productName}</td><td className="px-4 py-3 text-right font-bold text-slate-600">{number(item.capacity)}</td><td className="px-4 py-3 text-right font-black text-emerald-700">+{number(item.productionCards)} ကဒ်</td><td className="px-4 py-3 text-right font-black text-rose-700">-{number(item.soldCards)} ကဒ်</td><td className={`px-4 py-3 text-right text-base font-black ${item.currentCards < 0 ? "text-rose-700" : "text-slate-900"}`}>{number(item.currentCards)} ကဒ်</td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedKey(item.productKey)} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800">ကြည့်ရန်</button></td></tr>)}</tbody></table></div></section> : null}
        {selected ? <section className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">{selected.productName} / {number(selected.capacity)} ဆံ့</h2><p className="mt-1 text-sm font-black text-orange-800">လက်ကျန် {number(selected.currentCards)} ကဒ်</p></div><button type="button" onClick={() => setSelectedKey("")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">ပိတ်</button></div><div className="mt-4 space-y-2">{selectedMovements.map((movement) => <div key={movement.id} className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-slate-900">{movementLabel(movement.movementType)}</p><p className="text-xs text-slate-500">{movement.movementDate} · {movement.sourceType || "manual"}</p></div><p className={`text-base font-black ${movement.quantityCards < 0 ? "text-rose-700" : "text-emerald-700"}`}>{movement.quantityCards > 0 ? "+" : ""}{number(movement.quantityCards)} ကဒ်</p></div>)}</div></section> : null}
      </div>
    </main>
  );
}
