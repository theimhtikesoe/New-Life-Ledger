"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BAG_RULES } from "@/lib/packaging-bag-calculator";
import { encodeActorHeader } from "@/lib/actor-header";

function todayMyanmar() {
  const now = new Date(Date.now() + (6 * 60 + 30) * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}
function formatNumber(value) { return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function shiftDate(value, delta) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + delta); return date.toISOString().slice(0, 10); }
function actorHeaders(headers = {}) { const actorName = typeof window !== "undefined" ? window.localStorage.getItem("actorName") || "" : ""; return { ...headers, "x-actor-name": encodeActorHeader(actorName) }; }
function movementLabel(movement) { return movement.movementType === "PRODUCTION_USE_OUT" ? "သုံးစွဲ" : "အသစ်ဝင်"; }
function compactMovements(movements = [], { dateOnly = "" } = {}) {
  const grouped = new Map();
  movements.filter((movement) => !dateOnly || movement.movementDate === dateOnly).forEach((movement) => {
    const quantity = Number(movement.quantityBottles || movement.quantityCards || 0);
    const key = `${movement.movementDate}|${movement.productKey}|${movement.movementType}`;
    const current = grouped.get(key) || { key, date: movement.movementDate, productName: movement.productName, type: movementLabel(movement), quantity: 0, note: movement.note || "" };
    current.quantity += quantity;
    if (!current.note && movement.note) current.note = movement.note;
    grouped.set(key, current);
  });
  return [...grouped.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.productName).localeCompare(String(b.productName), "my"));
}

export default function PackagingBagStockPage() {
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ bagSize: BAG_RULES[0].bagSize, bags: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingMovement, setEditingMovement] = useState(null);
  const [editForm, setEditForm] = useState({ bagSize: BAG_RULES[0].bagSize, bags: "", date: "", note: "" });

  useEffect(() => { const queryDate = new URLSearchParams(window.location.search).get("date"); setDate(/^\d{4}-\d{2}-\d{2}$/.test(queryDate || "") ? queryDate : todayMyanmar()); }, []);
  const loadStock = useCallback(async () => {
    if (!date) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/packaging-bag-stock?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "အိတ်ခွံလက်ကျန် ရယူ၍မရပါ။");
      setData(body.data);
    } catch (loadError) { setError(loadError.message || "အိတ်ခွံလက်ကျန် ရယူ၍မရပါ။"); } finally { setLoading(false); }
  }, [date]);
  useEffect(() => { loadStock(); }, [loadStock]);

  const summary = data?.summary || [];
  const dailyUsed = useMemo(() => compactMovements(data?.dailyUsed || [], { dateOnly: date }), [data, date]);
  const dailyAdded = useMemo(() => compactMovements(data?.dailyAdded || [], { dateOnly: date }), [data, date]);
  const dailyUsedTotal = dailyUsed.reduce((sum, row) => sum + Math.abs(row.quantity), 0);
  const dailyAddedTotal = dailyAdded.reduce((sum, row) => sum + Math.max(0, row.quantity), 0);

  async function saveStock(event) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/packaging-bag-stock", { method: "POST", headers: actorHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ ...form, date }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "အိတ်ခွံ Stock ထည့်၍မရပါ။");
      setMessage("အိတ်ခွံ Stock ထည့်သိမ်းပြီးပါပြီ။"); setForm({ ...form, bags: "", note: "" }); await loadStock();
    } catch (saveError) { setError(saveError.message || "အိတ်ခွံ Stock ထည့်၍မရပါ။"); } finally { setSaving(false); }
  }

  function beginEdit(movement) {
    setEditingMovement(movement);
    setEditForm({ bagSize: String(movement.productKey || "").replace(/^BAG::/, "") || BAG_RULES[0].bagSize, bags: String(Math.abs(Number(movement.quantityBottles || movement.quantityCards || 0))), date: movement.movementDate || date, note: movement.note || "" });
    setError(""); setMessage("");
  }

  async function updateStock(event) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/packaging-bag-stock", { method: "PATCH", headers: actorHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ id: editingMovement.id, ...editForm }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "အိတ်ခွံ Stock ပြင်၍မရပါ။");
      setEditingMovement(null); setMessage("အိတ်ခွံ Stock မှတ်တမ်း ပြင်ပြီးပါပြီ။"); await loadStock();
    } catch (updateError) { setError(updateError.message || "အိတ်ခွံ Stock ပြင်၍မရပါ။"); } finally { setSaving(false); }
  }

  async function deleteStock(movement) {
    if (!window.confirm(`${movement.productName} ${formatNumber(Math.abs(Number(movement.quantityBottles || movement.quantityCards || 0)))} အိတ်ကို ဖျက်မလား?`)) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/packaging-bag-stock?id=${encodeURIComponent(movement.id)}`, { method: "DELETE", headers: actorHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "အိတ်ခွံ Stock ဖျက်၍မရပါ။");
      setMessage("အိတ်ခွံ Stock မှတ်တမ်း ဖျက်ပြီးပါပြီ။"); await loadStock();
    } catch (deleteError) { setError(deleteError.message || "အိတ်ခွံ Stock ဖျက်၍မရပါ။"); } finally { setSaving(false); }
  }

  return <main className="app-page-main"><div className="app-page-container app-page-surface space-y-4 pt-5 sm:pt-6">
    <section className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-cyan-700">ထုပ်ပိုးအိတ်ခွံ အဝင်၊ သုံးစွဲမှုနှင့် လက်ကျန်</p><p className="mt-1 text-xs text-slate-500">အောက်ပါစာရင်းများကို အိတ်အရွယ်အစားအလိုက် စုစည်းပြထားပါသည်။</p></div><div className="grid grid-cols-3 gap-2 text-right"><div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2"><p className="text-[11px] font-bold text-cyan-700">လက်ကျန်</p><p className="text-lg font-black text-cyan-950">{loading ? "..." : `${formatNumber(data?.totalCurrentBags)} အိတ်`}</p></div><div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2"><p className="text-[11px] font-bold text-rose-700">ယနေ့သုံး</p><p className="text-lg font-black text-rose-950">{loading ? "..." : `${formatNumber(dailyUsedTotal)} အိတ်`}</p></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2"><p className="text-[11px] font-bold text-emerald-700">ယနေ့ဝင်</p><p className="text-lg font-black text-emerald-950">{loading ? "..." : `${formatNumber(dailyAddedTotal)} အိတ်`}</p></div></div></div>
      <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-sm font-black text-cyan-900">Usage Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block min-h-10 rounded-lg border-2 border-cyan-200 bg-cyan-50 px-3 py-2 font-bold text-cyan-900" /></label>{[-1, 0, 1].map((delta) => { const value = shiftDate(todayMyanmar(), delta); const label = delta === -1 ? "မနေ့" : delta === 0 ? "ဒီနေ့" : "မနက်ဖြန်"; return <button key={label} type="button" onClick={() => setDate(value)} className={`rounded-lg border px-3 py-2 text-sm font-black ${date === value ? "border-cyan-600 bg-cyan-600 text-white" : "border-cyan-200 bg-cyan-50 text-cyan-800"}`}>{label}</button>; })}</div>
    </section>

    <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-base font-black text-violet-900">အိတ်ခွံ အသစ်ဝင် Stock ထည့်ရန်</h2><form onSubmit={saveStock} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs font-bold text-slate-700">Stock ဝင်ရက်<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-sm font-bold" /></label><label className="text-xs font-bold text-slate-700">အိတ်အရွယ်အစား<select value={form.bagSize} onChange={(event) => setForm({ ...form, bagSize: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 bg-white px-2 text-sm font-bold">{BAG_RULES.map((rule) => <option key={rule.bagSize} value={rule.bagSize}>{rule.bagSize} အိတ်</option>)}</select></label><label className="text-xs font-bold text-slate-700">အိတ်အရေအတွက်<input type="number" min="1" step="1" required value={form.bags} onChange={(event) => setForm({ ...form, bags: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-center text-sm font-black" placeholder="ဥပမာ 80" /></label><label className="text-xs font-bold text-slate-700">မှတ်ချက်<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-sm" placeholder="အသစ်ရောက် / လက်ရှိစာရင်း" /></label><button disabled={saving} className="h-10 self-end rounded-lg bg-violet-700 px-4 text-sm font-black text-white disabled:opacity-50">{saving ? "သိမ်းနေသည်..." : "Stock ထည့်သိမ်းမည်"}</button></form>{message ? <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{message}</p> : null}</section>
    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-cyan-100 bg-cyan-50 px-4 py-3"><h2 className="font-black text-cyan-950">အိတ်အရွယ်အစားအလိုက် စုစုပေါင်း</h2><span className="text-xs font-bold text-cyan-700">အဝင် − သုံးစွဲ = လက်ကျန်</span></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left text-xs font-black text-slate-600"><tr><th className="px-4 py-2">အိတ်အရွယ်</th><th className="px-4 py-2 text-right">အသစ်ဝင်</th><th className="px-4 py-2 text-right">သုံးစွဲ</th><th className="px-4 py-2 text-right">လက်ကျန်</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan="4" className="px-4 py-6 text-center font-bold text-slate-500">ရယူနေသည်...</td></tr> : summary.map((item) => <tr key={item.bagSize}><td className="px-4 py-2 font-black text-slate-900">{item.bagSize}</td><td className="px-4 py-2 text-right font-bold text-emerald-700">+{formatNumber(item.addedBags)}</td><td className="px-4 py-2 text-right font-bold text-rose-700">-{formatNumber(item.usedBags)}</td><td className={`px-4 py-2 text-right font-black ${item.systemCurrentBags < 0 ? "text-rose-700" : "text-cyan-900"}`}>{formatNumber(item.currentBags)} အိတ်</td></tr>)}</tbody></table></div></section>

    <div className="grid gap-3 lg:grid-cols-2"><CompactMovementCard title={`ယနေ့ အိတ်ခွံသုံးစွဲမှု · ${date}`} rows={dailyUsed} empty="ဒီနေ့ သုံးစွဲမှု မရှိသေးပါ။" tone="rose" /><EditableMovementCard title={`ယနေ့ အသစ်ဝင် Stock · ${date}`} rows={data?.dailyAdded || []} empty="ဒီနေ့ အသစ်ဝင် Stock မရှိသေးပါ။" onEdit={beginEdit} onDelete={deleteStock} saving={saving} /></div>

    {editingMovement ? <div className="fixed inset-0 z-[170] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="edit-packaging-bag-title" className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 id="edit-packaging-bag-title" className="text-lg font-black text-slate-900">အိတ်ခွံ Stock မှတ်တမ်း ပြင်ရန်</h2><p className="mt-1 text-xs font-bold text-slate-500">Manual Stock ထည့်မှတ်တမ်းကိုသာ ပြင်နိုင်ပါသည်။</p></div><button type="button" onClick={() => setEditingMovement(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold">ပိတ်</button></div><form onSubmit={updateStock} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">ရက်စွဲ<input type="date" required value={editForm.date} onChange={(event) => setEditForm({ ...editForm, date: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-2" /></label><label className="text-xs font-bold">အိတ်အရွယ်အစား<select value={editForm.bagSize} onChange={(event) => setEditForm({ ...editForm, bagSize: event.target.value })} className="mt-1 h-10 w-full rounded-lg border bg-white px-2">{BAG_RULES.map((rule) => <option key={rule.bagSize} value={rule.bagSize}>{rule.bagSize} အိတ်</option>)}</select></label><label className="text-xs font-bold">အိတ်အရေအတွက်<input type="number" min="1" step="1" required value={editForm.bags} onChange={(event) => setEditForm({ ...editForm, bags: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-2" /></label><label className="text-xs font-bold">မှတ်ချက်<input value={editForm.note} onChange={(event) => setEditForm({ ...editForm, note: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-2" /></label><div className="flex gap-2 sm:col-span-2"><button type="button" onClick={() => setEditingMovement(null)} className="flex-1 rounded-lg border py-2 font-bold">မလုပ်တော့ပါ</button><button disabled={saving} className="flex-1 rounded-lg bg-violet-700 py-2 font-black text-white">{saving ? "သိမ်းနေသည်..." : "ပြင်ပြီးသိမ်းမည်"}</button></div></form></section></div> : null}
  </div></main>;
}

function CompactMovementCard({ title, rows, empty, tone }) {
  const styles = tone === "rose" ? { border: "border-rose-200", bg: "bg-rose-50", title: "text-rose-900", value: "text-rose-700" } : { border: "border-emerald-200", bg: "bg-emerald-50", title: "text-emerald-900", value: "text-emerald-700" };
  return <section className={`rounded-2xl border ${styles.border} bg-white p-4 shadow-sm`}><div className="flex items-center justify-between gap-2"><h2 className={`font-black ${styles.title}`}>{title}</h2><span className={`rounded-full ${styles.bg} px-2 py-1 text-xs font-black ${styles.value}`}>{formatNumber(rows.reduce((sum, row) => sum + Math.abs(row.quantity), 0))} အိတ်</span></div>{rows.length ? <div className="mt-2 overflow-x-auto"><table className="min-w-full text-sm"><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.key}><td className="py-2 font-bold text-slate-800">{row.productName}</td><td className={`py-2 text-right font-black ${styles.value}`}>{row.quantity < 0 ? "−" : "+"}{formatNumber(Math.abs(row.quantity))} အိတ်</td></tr>)}</tbody></table></div> : <p className="py-4 text-center text-sm font-bold text-slate-500">{empty}</p>}</section>;
}

function EditableMovementCard({ title, rows, empty, onEdit, onDelete, saving }) {
  const styles = { border: "border-emerald-200", bg: "bg-emerald-50", title: "text-emerald-900", value: "text-emerald-700" };
  return <section className={`rounded-2xl border ${styles.border} bg-white p-4 shadow-sm`}><div className="flex items-center justify-between gap-2"><h2 className={`font-black ${styles.title}`}>{title}</h2><span className={`rounded-full ${styles.bg} px-2 py-1 text-xs font-black ${styles.value}`}>{formatNumber(rows.reduce((sum, row) => sum + Math.max(0, Number(row.quantityBottles || row.quantityCards || 0)), 0))} အိတ်</span></div>{rows.length ? <div className="mt-2 space-y-2">{rows.map((row, index) => { const quantity = Number(row.quantityBottles || row.quantityCards || 0); return <div key={`${row.id || row.sourceId || row.productKey}-${index}`} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-800">{row.productName}</p><p className="text-xs text-slate-500">{row.movementDate}{row.note ? ` · ${row.note}` : ""}</p></div><p className={`font-black ${styles.value}`}>+{formatNumber(quantity)} အိတ်</p></div><div className="mt-2 flex justify-end gap-2 border-t border-emerald-100 pt-2"><button type="button" onClick={() => onEdit(row)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">ပြင်ရန်</button><button type="button" disabled={saving} onClick={() => onDelete(row)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 disabled:opacity-50">ဖျက်ရန်</button></div></div>; })}</div> : <p className="py-4 text-center text-sm font-bold text-slate-500">{empty}</p>}</section>;
}
