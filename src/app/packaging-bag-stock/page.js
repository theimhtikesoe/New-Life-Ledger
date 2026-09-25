"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BAG_RULES, SALA_SACK_WEIGHT_LB } from "@/lib/packaging-bag-calculator";
import { encodeActorHeader } from "@/lib/actor-header";

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function todayValue() {
  const now = new Date();
  const local = new Date(now.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}
function actorHeaders(headers = {}) {
  const actorName = typeof window !== "undefined" ? window.localStorage.getItem("actorName") || "" : "";
  return { ...headers, "x-actor-name": encodeActorHeader(actorName) };
}
const EMPTY_FORM = { movementDate: todayValue(), bagSize: BAG_RULES[0].bagSize, sacks: "", extraPieces: "", pieces: "", note: "" };

export default function PackagingBagStockPage() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedSize, setSelectedSize] = useState("");

  const loadStock = useCallback(async () => {
    const response = await fetch(`/api/packaging-bag-stock?date=${encodeURIComponent(form.movementDate)}&refresh=${Date.now()}`, { cache: "no-store", headers: actorHeaders() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "ထုပ်ပိုးအိတ်ခွံ လက်ကျန် ရယူ၍မရပါ။");
    setData(body.data);
  }, [form.movementDate]);

  useEffect(() => {
    loadStock().catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, [loadStock]);

  const rows = useMemo(() => BAG_RULES.map((rule) => {
    const found = (data?.summary || []).find((item) => item.bagSize === rule.bagSize);
    return found || { ...rule, addedPieces: 0, usedPieces: 0, currentPieces: 0, addedBags: 0, usedBags: 0, currentBags: 0 };
  }), [data]);
  const selected = rows.find((row) => row.bagSize === selectedSize);
  const selectedMovements = (data?.movements || []).filter((movement) => String(movement.productKey || "").replace(/^BAG::/, "") === selectedSize);
  const totalAdded = rows.reduce((sum, row) => sum + Number(row.addedPieces || 0), 0);
  const totalUsed = rows.reduce((sum, row) => sum + Number(row.usedPieces || 0), 0);
  const totalCurrent = rows.reduce((sum, row) => sum + Number(row.currentPieces || 0), 0);

  async function saveStock(event) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/packaging-bag-stock", {
        method: "POST",
        headers: actorHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ...form, sacks: form.sacks || undefined, extraPieces: form.extraPieces || undefined, pieces: form.pieces || undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Stock သိမ်း၍မရပါ။");
      setMessage("ထုပ်ပိုးအိတ်ခွံ Stock ထည့်သိမ်းပြီးပါပြီ။");
      setForm({ ...EMPTY_FORM, movementDate: form.movementDate });
      await loadStock();
    } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
  }

  async function deleteMovement(movement) {
    if (movement.derived || !movement.id) return;
    if (!window.confirm(`${movement.productName} ${formatNumber(movement.quantityBottles)} လုံး မှတ်တမ်းကို ဖျက်မှာ သေချာပါသလား။`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/packaging-bag-stock?id=${encodeURIComponent(movement.id)}`, { method: "DELETE", headers: actorHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Stock မှတ်တမ်း ဖျက်၍မရပါ။");
      setMessage("Stock မှတ်တမ်း ဖျက်ပြီးပါပြီ။");
      await loadStock();
    } catch (deleteError) { setError(deleteError.message); } finally { setSaving(false); }
  }

  return (
    <main className="app-page-main">
      <div className="app-page-container app-page-surface space-y-4 pt-5 sm:pt-6">
        <section className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-cyan-700">ထုပ်ပိုးအိတ်ခွံ လုံးရေတွက်ချက်ရန်</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">ဆာလာအိတ် {formatNumber(SALA_SACK_WEIGHT_LB)} ပေါင် အခြေခံတွက်ချက်မှုနှင့် Stock</h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-600">အောက်ပါဇယားသည် size အလိုက် 100 ပေါင် ဆာလာအိတ်တစ်အိတ်မှာ ထုပ်နှင့် လုံး ဘယ်လောက်ရနိုင်သည်ကို ပြသသော reference ဖြစ်ပါသည်။ အောက်က Stock စာရင်းမှာတော့ လက်ရှိစက်ရုံအဝင်၊ ထုတ်လုပ်မှုမှာ သုံးစွဲမှုနှင့် လက်ကျန်ကို သီးခြားတွက်ချက်ပြပါသည်။</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900"><p>Stock တိုး</p><p className="mt-1 text-lg font-black">{loading ? "…" : formatNumber(totalAdded)}</p><p>လုံး</p></div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900"><p>သုံးစွဲ</p><p className="mt-1 text-lg font-black">{loading ? "…" : formatNumber(totalUsed)}</p><p>လုံး</p></div>
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-cyan-900"><p>လက်ကျန်</p><p className="mt-1 text-lg font-black">{loading ? "…" : formatNumber(totalCurrent)}</p><p>လုံး</p></div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-violet-900">ထုပ်ပိုးအိတ်ခွံ Stock အသစ်ထည့်ရန်</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">ဆာလာအိတ်အရေအတွက်နဲ့ ထည့်နိုင်သလို အပိုလုံးရေကိုလည်း ထည့်နိုင်ပါသည်။ ထည့်ထားသော stock ကို ထုတ်လုပ်မှုက သုံးသွားသည့် လုံးရေဖြင့် အလိုအလျောက်နုတ်ပါမည်။</p>
          <form onSubmit={saveStock} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="text-xs font-bold text-slate-700">ရက်စွဲ<input type="date" required value={form.movementDate} onChange={(event) => setForm({ ...form, movementDate: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-sm font-bold" /></label>
            <label className="text-xs font-bold text-slate-700">အိတ်ခွံအရွယ်အစား<select required value={form.bagSize} onChange={(event) => setForm({ ...form, bagSize: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 bg-white px-2 text-sm font-bold">{BAG_RULES.map((rule) => <option key={rule.bagSize} value={rule.bagSize}>{rule.bagSize} · {rule.piecesPerBag} လုံး/ထုပ်</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700">ဆာလာအိတ်အရေအတွက်<input type="number" min="0" step="1" value={form.sacks} onChange={(event) => setForm({ ...form, sacks: event.target.value, pieces: "" })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-center text-sm font-black" placeholder="ဥပမာ 1" /></label>
            <label className="text-xs font-bold text-slate-700">အပိုလုံး<input type="number" min="0" step="1" value={form.extraPieces} onChange={(event) => setForm({ ...form, extraPieces: event.target.value, pieces: "" })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-center text-sm font-black" placeholder="ဥပမာ 25" /></label>
            <label className="text-xs font-bold text-slate-700">တိုက်ရိုက်လုံးရေ<input type="number" min="1" step="1" value={form.pieces} onChange={(event) => setForm({ ...form, pieces: event.target.value, sacks: "", extraPieces: "" })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-center text-sm font-black" placeholder="သို့မဟုတ်" /></label>
            <label className="text-xs font-bold text-slate-700">မှတ်ချက်<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-sm" placeholder="အသစ်ဝင် / လက်ရှိ Stock" /></label>
            <button disabled={saving} className="h-10 self-end rounded-lg bg-violet-700 px-4 text-sm font-black text-white hover:bg-violet-800 disabled:opacity-50 sm:col-span-2 lg:col-span-1">{saving ? "သိမ်းနေသည်..." : "Stock ထည့်သိမ်းမည်"}</button>
          </form>
          {message ? <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p> : null}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-cyan-100 bg-cyan-50 px-4 py-3"><h2 className="font-black text-cyan-950">အရွယ်အစားအလိုက် ဆာလာအိတ် ၁ အိတ် တွက်ချက်မှု</h2><p className="mt-1 text-xs font-bold text-cyan-700">ထုပ်အရေအတွက် = 100 ÷ တစ်ထုပ်အလေးချိန် · လုံးရေ = ထုပ်အရေအတွက် × တစ်ထုပ်ပါလုံး</p></div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-100 text-left text-xs font-black text-slate-700"><tr><th className="px-4 py-3">အရွယ်အစား</th><th className="px-4 py-3 text-right">တစ်ထုပ်ပါ လုံး</th><th className="px-4 py-3 text-right">တစ်ထုပ်အလေးချိန်</th><th className="px-4 py-3 text-right">100 ပေါင်တွင် ထုပ်</th><th className="px-4 py-3 text-right">စုစုပေါင်းလုံး</th></tr></thead><tbody className="divide-y divide-slate-100">{BAG_RULES.map((rule) => <tr key={rule.bagSize} className="hover:bg-cyan-50/50"><td className="px-4 py-3 font-black text-slate-900">{rule.label}</td><td className="px-4 py-3 text-right font-bold text-slate-700">{formatNumber(rule.piecesPerBag)}</td><td className="px-4 py-3 text-right font-bold text-slate-700">{formatNumber(rule.weightLb)} ပေါင်</td><td className="px-4 py-3 text-right font-black text-violet-700">{formatNumber(rule.packsPerSack)}</td><td className="px-4 py-3 text-right text-lg font-black text-cyan-800">{formatNumber(rule.piecesPerSack)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3"><h2 className="font-black text-emerald-950">အိတ်ခွံအရွယ်အစားအလိုက် Stock စာရင်း</h2><p className="mt-1 text-xs font-bold text-emerald-700">ထွက်ရှိသော ဗူးကဒ် ၁ ကဒ်ကို သက်ဆိုင်ရာအရွယ်အစား အိတ်ခွံ ၁ လုံးအဖြစ် အလိုအလျောက်နုတ်ထားပါသည်။ အသေးစိတ်ကြည့်ရန် row ကိုနှိပ်ပါ။</p></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-100 text-left text-xs font-black text-slate-700"><tr><th className="px-4 py-3">အရွယ်အစား</th><th className="px-4 py-3 text-right">Stock တိုး (လုံး)</th><th className="px-4 py-3 text-right">သုံးစွဲ (လုံး)</th><th className="px-4 py-3 text-right">လက်ကျန် (လုံး)</th><th className="px-4 py-3 text-right">လက်ကျန် ဆာလာအိတ်ခန့်မှန်း</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.bagSize} onClick={() => setSelectedSize(row.bagSize)} className="cursor-pointer hover:bg-emerald-50"><td className="px-4 py-3 font-black text-slate-900">{row.bagSize}</td><td className="px-4 py-3 text-right font-bold text-emerald-700">{formatNumber(row.addedPieces)}</td><td className="px-4 py-3 text-right font-bold text-rose-700">{formatNumber(row.usedPieces)}</td><td className="px-4 py-3 text-right text-lg font-black text-cyan-800">{formatNumber(row.currentPieces)}</td><td className="px-4 py-3 text-right font-bold text-violet-700">{formatNumber(row.currentBags)} ထုပ်</td></tr>)}</tbody></table></div></section>

        {selected ? <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSize(""); }}><section role="dialog" aria-modal="true" className="max-h-[90dvh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl"><div className="flex items-start justify-between border-b border-cyan-100 bg-cyan-50 px-4 py-4"><div><h2 className="text-lg font-black text-slate-900">{selected.bagSize} အိတ်ခွံ အသေးစိတ်</h2><p className="mt-1 text-sm font-bold text-cyan-800">လက်ကျန် {formatNumber(selected.currentPieces)} လုံး · သုံးစွဲ {formatNumber(selected.usedPieces)} လုံး</p></div><button type="button" onClick={() => setSelectedSize("")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">ပိတ်</button></div><div className="max-h-[70dvh] space-y-2 overflow-y-auto p-4">{selectedMovements.length ? selectedMovements.map((movement, index) => <article key={`${movement.id || movement.sourceId || "movement"}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{movement.derived ? "ထုတ်လုပ်မှုအလိုအလျောက်သုံးစွဲ" : "Stock အဝင်"}</p><p className="text-xs text-slate-500">{movement.movementDate}{movement.note ? ` · ${movement.note}` : ""}</p></div><p className={`text-right font-black ${Number(movement.quantityBottles) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{Number(movement.quantityBottles) > 0 ? "+" : ""}{formatNumber(movement.quantityBottles)} လုံး</p></div>{movement.derived ? <p className="mt-2 text-[11px] font-bold text-slate-500">ဗူးထုတ်လုပ်မှုမှ card ၁ ကဒ် = အိတ်ခွံ ၁ လုံး ဖြင့် အလိုအလျောက်နုတ်ထားသည်။</p> : <button type="button" disabled={saving} onClick={() => deleteMovement(movement)} className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">ဒီ Stock မှတ်တမ်း ဖျက်မည်</button>}</article>) : <p className="py-8 text-center font-bold text-slate-500">မှတ်တမ်းမရှိသေးပါ။</p>}</div></section></div> : null}
      </div>
    </main>
  );
}
