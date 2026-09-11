'use client';

import { useEffect, useMemo, useState } from "react";

function number(value) { return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function todayValue() { const now = new Date(); const local = new Date(now.getTime() + (6 * 60 + 30) * 60 * 1000); return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`; }
function movementLabel(type) {
  return ({ SALE_OUT: "ရောင်းထွက် / ဗူးတွင်သုံး", ADJUSTMENT_IN: "စာရင်းညှိဝင်", ADJUSTMENT_OUT: "စာရင်းညှိထွက်", REVERSAL: "ပြန်လှန်" })[type] || type;
}
const CAP_LOCATIONS = ["မန္တလေး", "အေးသာယာ", "Soe"];
const CAP_COLORS = ["ပြာ", "ဝါ", "စိမ်း", "နီ", "ဖြူ", "ပန်း", "နက်/အမဲ"];

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

  const caps = useMemo(() => {
    const source = (data?.summary || []).filter((item) => item.stockType === "CAP" && Number(item.capacity || 0) > 0);
    const byKey = new Map(source.map((item) => [item.productKey, item]));
    return CAP_LOCATIONS.flatMap((location) => CAP_COLORS.map((color) => {
      const key = `CAP::${location}::${color}::5000`;
      return byKey.get(key) || { productKey: key, stockType: "CAP", productName: `${location} · ${color}`, capacity: 5000, soldCards: 0, adjustmentCards: 0, currentCards: 0, currentBottles: 0 };
    }));
  }, [data]);
  const selected = caps.find((item) => item.productKey === selectedKey);
  const selectedMovements = (data?.movements || []).filter((item) => item.productKey === selectedKey);
  const totalPacks = caps.reduce((sum, item) => sum + Number(item.currentCards || 0), 0);
  const totalCaps = caps.reduce((sum, item) => sum + Number(item.currentBottles || 0), 0);
  const dailyCapUsage = useMemo(() => {
    const grouped = new Map();
    (data?.movements || []).filter((movement) => movement.movementDate === todayValue() && Number(movement.quantityBottles || 0) < 0).forEach((movement) => {
      const key = `${movement.productName}::${movement.capacity}`;
      const row = grouped.get(key) || { name: movement.productName, capacity: Number(movement.capacity || 0), pieces: 0 };
      row.pieces += Math.abs(Number(movement.quantityBottles || 0));
      grouped.set(key, row);
    });
    return [...grouped.values()].map((row) => ({ ...row, packs: row.capacity ? row.pieces / row.capacity : 0 }));
  }, [data]);
  const dailyCapPieces = dailyCapUsage.reduce((sum, row) => sum + row.pieces, 0);
  const [usageOpen, setUsageOpen] = useState(false);

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
            <div className="flex flex-wrap justify-end gap-2"><div className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-right"><p className="text-xs font-bold text-pink-700">စုစုပေါင်း အဖုံး Net Stock Change</p><p className="mt-1 text-xl font-black text-pink-950">{number(totalPacks)} အိတ်</p><p className="text-xs font-bold text-pink-800">စုစုပေါင်း {number(totalCaps)} ဖုံး</p></div><button type="button" onClick={() => setUsageOpen(true)} className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-right shadow-sm"><p className="text-xs font-bold text-rose-700">ယနေ့ အဖုံးသုံးစွဲမှု</p><p className="mt-1 text-xl font-black text-rose-950">{number(dailyCapPieces)} ဖုံး</p><p className="text-xs font-bold text-rose-800">အသေးစိတ်ကြည့်ရန် →</p></button></div>
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
        {usageOpen ? <div className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUsageOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="daily-cap-usage-title" className="max-h-[85dvh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-w-xl"><div className="flex items-start justify-between gap-3 border-b border-rose-100 bg-rose-50 px-4 py-4"><div><h2 id="daily-cap-usage-title" className="text-lg font-black text-slate-900">ယနေ့ အဖုံးသုံးစွဲမှု</h2><p className="mt-1 text-sm font-bold text-rose-800">စုစုပေါင်း {number(dailyCapPieces)} ဖုံး</p></div><button type="button" onClick={() => setUsageOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">ပိတ်</button></div><div className="max-h-[65dvh] space-y-2 overflow-y-auto p-4">{dailyCapUsage.length ? dailyCapUsage.map((row) => <div key={`${row.name}-${row.capacity}`} className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50/60 p-3"><div><p className="font-black text-slate-900">{row.name}</p><p className="text-xs font-bold text-slate-500">{number(row.capacity)} ဆံ့ / အိတ် · {number(row.packs)} အိတ်</p></div><p className="text-right text-base font-black text-rose-700">-{number(row.pieces)} ဖုံး</p></div>) : <p className="py-8 text-center font-bold text-slate-500">ယနေ့ သုံးစွဲမှု မရှိသေးပါ။</p>}</div></section></div> : null}
        {selected ? <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedKey(""); }}><section role="dialog" aria-modal="true" aria-labelledby="cap-stock-detail-title" className="max-h-[85dvh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl"><div className="flex items-start justify-between gap-3 border-b border-pink-100 bg-pink-50 px-4 py-4"><div><h2 id="cap-stock-detail-title" className="text-lg font-black text-slate-900">{selected.productName} အသေးစိတ်</h2><p className="mt-1 text-sm font-bold text-pink-800">လက်ရှိ {number(selected.currentCards)} အိတ် · {number(selected.currentBottles)} ဖုံး</p></div><button type="button" onClick={() => setSelectedKey("")} aria-label="အသေးစိတ်ပိတ်ရန်" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">ပိတ်</button></div><div className="max-h-[65dvh] space-y-2 overflow-y-auto p-4">{selectedMovements.length ? selectedMovements.map((movement, index) => <div key={`${movement.sourceId || "movement"}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><div><p className="font-black text-slate-900">{movementLabel(movement.movementType)}</p><p className="text-xs text-slate-500">{movement.movementDate} · {movement.sourceType || "manual"}{movement.note ? ` · ${movement.note}` : ""}</p></div><p className={`text-right font-black ${Number(movement.quantityCards) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{Number(movement.quantityBottles) > 0 ? "+" : ""}{number(Number(movement.quantityBottles || 0) / Number(movement.capacity || 1))} အိတ်<br /><span className="text-xs">{Number(movement.quantityBottles) > 0 ? "+" : ""}{number(movement.quantityBottles)} ဖုံး</span></p></div>) : <p className="py-5 text-center text-sm font-bold text-slate-500">Movement မရှိသေးပါ။</p>}</div></section></div> : null}
      </div>
    </main>
  );
}
