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
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [capForm, setCapForm] = useState({ location: "မန္တလေး", color: "ပြာ", packSize: "5000", packs: "", note: "" });

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

  const caps = useMemo(() => (data?.summary || []).filter((item) => item.stockType === "CAP" && Number(item.capacity || 0) > 0), [data]);
  const selected = caps.find((item) => item.productKey === selectedKey);
  const selectedMovements = (data?.movements || []).filter((item) => item.productKey === selectedKey);
  const totalPacks = caps.reduce((sum, item) => sum + Number(item.currentCards || 0), 0);
  const totalCaps = caps.reduce((sum, item) => sum + Number(item.currentBottles || 0), 0);

  async function saveCapStock(event) {
    event.preventDefault();
    setSaving(true); setError(""); setSaveMessage("");
    try {
      const response = await fetch("/api/factory-stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "addCapStock", rows: [capForm] }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "အဖုံး Stock သိမ်း၍မရပါ။");
      setSaveMessage("အဖုံး Stock ထည့်သိမ်းပြီးပါပြီ။");
      setCapForm((current) => ({ ...current, packs: "", note: "" }));
      const refreshed = await fetch(`/api/factory-stock?stockType=CAP&capRefresh=${Date.now()}`, { cache: "no-store" });
      const refreshedBody = await refreshed.json();
      if (refreshed.ok) setData(refreshedBody.data);
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  }

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-4 pt-5 sm:pt-6">
        <section className="rounded-2xl border border-pink-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-sm font-bold text-pink-700">အဖုံးအရောင်အလိုက် စက်ရုံလက်ကျန်</p><p className="mt-1 text-xs text-slate-500">ဗူးရောင်းတိုင်း ပုံမှန်အဖုံးနှင့် အပိုအဖုံးကို အရောင်အလိုက် အလိုအလျောက်နုတ်တွက်ထားသည်။</p></div>
            <div className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-right"><p className="text-xs font-bold text-pink-700">စုစုပေါင်း အဖုံး Net Stock Change</p><p className="mt-1 text-xl font-black text-pink-950">{number(totalPacks)} အိတ်</p><p className="text-xs font-bold text-pink-800">စုစုပေါင်း {number(totalCaps)} ဖုံး</p></div>
          </div>
        </section>
        <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-violet-900">အဖုံး Stock အသစ် / လက်ရှိ Stock ထည့်ရန်</h2>
          <p className="mt-1 text-xs text-slate-500">တစ်အိတ်မှာ ဆံ့သည့်အရေအတွက်ကို 5000 / 100 လို ထည့်ပြီး အိတ်အရေအတွက်ကို ထည့်ပါ။ နောက်ထပ်ရောက်တိုင်း ဒီနေရာကနေ ထပ်ထည့်နိုင်ပါတယ်။</p>
          <form onSubmit={saveCapStock} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="text-xs font-bold text-slate-700">နေရာ<select value={capForm.location} onChange={(event) => setCapForm({ ...capForm, location: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 bg-white px-2 text-sm font-bold"><option>မန္တလေး</option><option>အေးသာယာ</option><option>Soe</option><option>အခြား</option></select></label>
            <label className="text-xs font-bold text-slate-700">အဖုံးအရောင်<select value={capForm.color} onChange={(event) => setCapForm({ ...capForm, color: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 bg-white px-2 text-sm font-bold"><option>ပြာ</option><option>ဝါ</option><option>စိမ်း</option><option>နီ</option><option>ဖြူ</option><option>ပန်း</option><option>နက်/အမဲ</option></select></label>
            <label className="text-xs font-bold text-slate-700">တစ်အိတ်ဆံ့<select value={capForm.packSize} onChange={(event) => setCapForm({ ...capForm, packSize: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 bg-white px-2 text-sm font-bold"><option value="5000">5000 ဆံ့ / အိတ်</option><option value="100">100 ဆံ့ / အိတ်</option></select></label>
            <label className="text-xs font-bold text-slate-700">အိတ်အရေအတွက်<input type="number" min="1" step="1" required value={capForm.packs} onChange={(event) => setCapForm({ ...capForm, packs: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-center text-sm font-black" placeholder="ဥပမာ 38" /></label>
            <label className="text-xs font-bold text-slate-700 sm:col-span-2">မှတ်ချက်<input value={capForm.note} onChange={(event) => setCapForm({ ...capForm, note: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-sm" placeholder="လက်ရှိစာရင်း / အသစ်ရောက်" /></label>
            <button disabled={saving} className="h-10 self-end rounded-lg bg-violet-700 px-4 text-sm font-black text-white hover:bg-violet-800 disabled:opacity-50">{saving ? "သိမ်းနေသည်..." : "Stock ထည့်သိမ်းမည်"}</button>
          </form>
          {saveMessage ? <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{saveMessage}</p> : null}
        </section>
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</div> : null}
        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">အဖုံးလက်ကျန် ရယူနေသည်...</div> : null}
        {!loading && !caps.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center font-bold text-slate-500">အဖုံး stock movement မရှိသေးပါ။</div> : null}
        {!loading && caps.length ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-pink-50 text-left text-xs font-black text-pink-900"><tr><th className="px-4 py-3">နေရာ · အဖုံးအရောင်</th><th className="px-4 py-3 text-right">ရောင်း/သုံးထွက်</th><th className="px-4 py-3 text-right">စာရင်းညှိဝင်</th><th className="px-4 py-3 text-right">လက်ကျန်အိတ်</th><th className="px-4 py-3 text-right">လက်ကျန်အဖုံး</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{caps.map((item) => <tr key={item.productKey}><td className="px-4 py-3 font-black text-slate-900">{item.productName}<p className="text-[11px] font-bold text-slate-500">{number(item.capacity)} ဆံ့ / အိတ်</p></td><td className="px-4 py-3 text-right font-bold text-rose-700">-{number(item.soldCards)} အိတ်</td><td className="px-4 py-3 text-right font-bold text-slate-700">+{number(item.adjustmentCards)} အိတ်</td><td className={`px-4 py-3 text-right text-base font-black ${Number(item.currentCards || 0) < 0 ? "text-rose-700" : "text-slate-900"}`}>{number(item.currentCards)} အိတ်</td><td className="px-4 py-3 text-right font-black text-pink-900">{number(item.currentBottles)} ဖုံး</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => setSelectedKey(item.productKey)} className="rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 text-xs font-black text-pink-800">အသေးစိတ်</button></td></tr>)}</tbody></table></div></section> : null}
        {selected ? <section className="rounded-2xl border border-pink-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">{selected.productName} အသေးစိတ်</h2><p className="text-sm font-bold text-pink-800">လက်ရှိ {number(selected.currentCards)} အိတ် · {number(selected.currentBottles)} ဖုံး</p></div><button type="button" onClick={() => setSelectedKey("")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">ပိတ်</button></div><div className="mt-4 space-y-2">{selectedMovements.length ? selectedMovements.map((movement, index) => <div key={`${movement.sourceId || "movement"}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><div><p className="font-black text-slate-900">{movementLabel(movement.movementType)}</p><p className="text-xs text-slate-500">{movement.movementDate} · {movement.sourceType || "manual"}{movement.note ? ` · ${movement.note}` : ""}</p></div><p className={`text-right font-black ${Number(movement.quantityCards) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{Number(movement.quantityCards) > 0 ? "+" : ""}{number(movement.quantityCards)} အိတ်<br /><span className="text-xs">{Number(movement.quantityBottles) > 0 ? "+" : ""}{number(movement.quantityBottles)} ဖုံး</span></p></div>) : <p className="py-5 text-center text-sm font-bold text-slate-500">Movement မရှိသေးပါ။</p>}</div></section> : null}
      </div>
    </main>
  );
}
