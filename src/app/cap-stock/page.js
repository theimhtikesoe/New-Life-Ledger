'use client';

import ThemedSelect from "@/components/ThemedSelect";
import { CAP_ITEMS, isPieceCapProduct } from "@/lib/production-catalog";


import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeActorHeader } from "@/lib/actor-header";

function number(value) { return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function todayValue() { const now = new Date(); const local = new Date(now.getTime() + (6 * 60 + 30) * 60 * 1000); return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`; }
function movementLabel(type) { return ({ SALE_OUT: "ရောင်းထွက် / ဗူးတွင်သုံး", ADJUSTMENT_IN: "စာရင်းညှိဝင်", ADJUSTMENT_OUT: "စာရင်းညှိထွက်", REVERSAL: "ပြန်လှန်" })[type] || type; }
function actorHeaders(headers = {}) { const actorName = typeof window !== "undefined" ? window.localStorage.getItem("actorName") || "" : ""; return { ...headers, "x-actor-name": encodeActorHeader(actorName) }; }
function notifyCapStockChanged() { if (typeof window !== "undefined") { localStorage.setItem("new-life-ledger:cap-stock-updated-at", String(Date.now())); window.dispatchEvent(new Event("new-life-ledger:cap-stock-updated")); } }
const CAP_LOCATIONS = ["မန္တလေး", "အေးသာယာ", "Soe", "အခြား"];
const CAP_COLORS = ["ပြာ", "ဝါ", "စိမ်း", "နီ", "ဖြူ", "ပန်း", "နက်/အမဲ"];
const EMPTY_FORM = { location: "မန္တလေး", color: "ပြာ", capProductKey: "CAP_BLUE", capProductName: "အဖုံး - ပြာ", packSize: "5000", packs: "", note: "", movementDate: todayValue() };
function isPieceCapRow(item) { return isPieceCapProduct(item?.productKey) || isPieceCapProduct(item?.productName); }

export default function CapStockPage() {
  const [data, setData] = useState(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [editingMovement, setEditingMovement] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [capForm, setCapForm] = useState(EMPTY_FORM);
  const [usageOpen, setUsageOpen] = useState(false);
  const [addedOpen, setAddedOpen] = useState(false);

  const loadStock = useCallback(async () => {
    const response = await fetch(`/api/factory-stock?stockType=CAP&capRefresh=${Date.now()}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "အဖုံးလက်ကျန် ရယူ၍မရပါ။");
    setData(body.data);
  }, []);

  useEffect(() => {
    loadStock().catch((fetchError) => setError(fetchError.message)).finally(() => setLoading(false));
  }, [loadStock]);

  const caps = useMemo(() => {
    const source = (data?.summary || []).filter((item) => item.stockType === "CAP" && (Number(item.capacity || 0) > 0 || String(item.productKey || "").startsWith("CAP::")));
    const byKey = new Map(source.map((item) => [item.productKey, item]));
    const standardRows = CAP_LOCATIONS.flatMap((location) => CAP_COLORS.map((color) => {
      const key = `CAP::${location}::${color}::5000`;
      return byKey.get(key) || { productKey: key, stockType: "CAP", productName: `${location} · ${color}`, capacity: 5000, soldCards: 0, adjustmentCards: 0, currentCards: 0, currentBottles: 0 };
    }));
    const standardKeys = new Set(standardRows.map((item) => item.productKey));
    const catalogRows = CAP_ITEMS.filter((item) => !CAP_COLORS.includes(String(item.productName || "").replace(/^အဖုံး\s*-\s*/, ""))).map((item) => {
      const stockKey = `CAP::${String(item.productName || "").replace(/^အဖုံး\s*-\s*/, "")}`;
      return byKey.get(stockKey) || { productKey: stockKey, stockCatalogKey: item.productKey, stockType: "CAP", productName: item.productName, capacity: isPieceCapRow(item) ? 1 : 5000, soldCards: 0, adjustmentCards: 0, currentCards: 0, currentBottles: 0 };
    });
    const catalogKeys = new Set(catalogRows.map((item) => item.productKey));
    return [...standardRows, ...catalogRows, ...source.filter((item) => !standardKeys.has(item.productKey) && !catalogKeys.has(item.productKey))];
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
  const dailyCapAdded = useMemo(() => {
    const grouped = new Map();
    (data?.movements || []).filter((movement) => movement.movementDate === todayValue() && movement.sourceType === "CAP_OPENING" && movement.movementType === "ADJUSTMENT_IN" && movement.note === "အသစ်ရောက်" && Number(movement.quantityBottles || 0) > 0).forEach((movement) => {
      const key = `${movement.productName}::${movement.capacity}`;
      const row = grouped.get(key) || { name: movement.productName, capacity: Number(movement.capacity || 0), pieces: 0 };
      row.pieces += Number(movement.quantityBottles || 0);
      grouped.set(key, row);
    });
    return [...grouped.values()].map((row) => ({ ...row, packs: row.capacity ? row.pieces / row.capacity : 0 }));
  }, [data]);
  const dailyCapAddedPieces = dailyCapAdded.reduce((sum, row) => sum + row.pieces, 0);
  const dailyCapAddedPacks = dailyCapAdded.reduce((sum, row) => sum + row.packs, 0);

  async function saveCapStock(event) {
    event.preventDefault(); setSaving(true); setError(""); setSaveMessage("");
    try {
      const response = await fetch("/api/factory-stock", { method: "POST", headers: actorHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ action: "addCapStock", rows: [capForm], date: capForm.movementDate }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "အဖုံး Stock သိမ်း၍မရပါ။");
      setSaveMessage("အဖုံး Stock ထည့်သိမ်းပြီးပါပြီ။"); setCapForm({ ...EMPTY_FORM, movementDate: todayValue() }); notifyCapStockChanged(); await loadStock();
    } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
  }

  function beginEdit(movement) {
    setEditingMovement(movement);
    const catalogCap = CAP_ITEMS.find((item) => movement.productKey === item.productKey);
    setEditForm({ location: String(movement.productName || "").split(" · ")[0] || "မန္တလေး", color: String(movement.productName || "").split(" · ").slice(1).join(" · ") || "ပြာ", capProductKey: catalogCap?.productKey || "", capProductName: catalogCap?.productName || "", packSize: String(movement.capacity || 5000), packs: String(movement.quantityCards || (Number(movement.quantityBottles || 0) / Number(movement.capacity || 1))), note: movement.note || "", movementDate: movement.movementDate || todayValue() });
  }

  async function updateMovement(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/factory-stock", { method: "PATCH", headers: actorHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ id: editingMovement.id, ...editForm }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "အဖုံး Stock ပြင်၍မရပါ။");
      setEditingMovement(null); setSaveMessage("အဖုံး Stock မှတ်တမ်း ပြင်ပြီးပါပြီ။"); notifyCapStockChanged(); await loadStock();
    } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
  }

  async function deleteMovement(movement) {
    if (!window.confirm(`${movement.productName} ${number(movement.quantityCards || 0)} အိတ် မှတ်တမ်းကို ဖျက်မှာ သေချာပါသလား?`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/factory-stock?id=${encodeURIComponent(movement.id)}`, { method: "DELETE", headers: actorHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "အဖုံး Stock မှတ်တမ်း ဖျက်၍မရပါ။");
      setSaveMessage("အဖုံး Stock မှတ်တမ်း ဖျက်ပြီးပါပြီ။"); notifyCapStockChanged(); await loadStock();
    } catch (deleteError) { setError(deleteError.message); } finally { setSaving(false); }
  }

  return <main className="app-page-main"><div className="app-page-container app-page-surface space-y-4 pt-5 sm:pt-6">
    <section className="rounded-2xl border border-pink-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-pink-700">အဖုံးအရောင်အလိုက် စက်ရုံလက်ကျန်</p><p className="mt-1 text-xs text-slate-500">ဗူးရောင်းတိုင်း ပုံမှန်အဖုံးနှင့် အပိုအဖုံးကို အရောင်အလိုက် အလိုအလျောက်နုတ်တွက်ထားသည်။</p></div><div className="flex flex-wrap justify-end gap-2"><div className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-right"><p className="text-xs font-bold text-pink-700">စုစုပေါင်း အဖုံး Net Stock Change</p><p className="mt-1 text-xl font-black text-pink-950">{loading ? "ရယူနေသည်..." : `${number(totalPacks)} အိတ်`}</p><p className="text-xs font-bold text-pink-800">{loading ? "ရယူနေသည်..." : `စုစုပေါင်း ${number(totalCaps)} ဖုံး`}</p></div><button type="button" onClick={() => setUsageOpen(true)} className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-right shadow-sm"><p className="text-xs font-bold text-rose-700">ယနေ့ အဖုံးသုံးစွဲမှု</p><p className="mt-1 text-xl font-black text-rose-950">{loading ? "ရယူနေသည်..." : `${number(dailyCapPieces)} ဖုံး`}</p><p className="text-xs font-bold text-rose-800">အသေးစိတ်ကြည့်ရန် →</p></button><button type="button" onClick={() => setAddedOpen(true)} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-right shadow-sm"><p className="text-xs font-bold text-emerald-700">ယနေ့ အသစ်ထည့်သော အဖုံး</p><p className="mt-1 text-xl font-black text-emerald-950">{loading ? "ရယူနေသည်..." : `${number(dailyCapAddedPieces)} ဖုံး`}</p><p className="text-xs font-bold text-emerald-800">{loading ? "ရယူနေသည်..." : `${number(dailyCapAddedPacks)} အိတ် · အသေးစိတ် →`}</p></button></div></div></section>
    <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-base font-black text-violet-900">အဖုံး Stock အသစ် / လက်ရှိ Stock ထည့်ရန်</h2><p className="mt-1 text-xs text-slate-500">ဂေါက်နှင့် 20 လီတာအဖုံးများကို အရေအတွက်တစ်ခုချင်း ထည့်ပါ။ အရောင်အဖုံးများအတွက်သာ တစ်အိတ်ဆံ့ပမာဏကို အသုံးပြုပါသည်။</p><form onSubmit={saveCapStock} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><label className="text-xs font-bold text-slate-700">ရက်စွဲ<input type="date" value={capForm.movementDate} onChange={(event) => setCapForm({ ...capForm, movementDate: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 bg-white px-2 text-sm font-bold" /></label><label className="text-xs font-bold text-slate-700">နေရာ<ThemedSelect value={capForm.location} onChange={(event) => setCapForm({ ...capForm, location: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 bg-white px-2 text-sm font-bold">{CAP_LOCATIONS.map((value) => <option key={value}>{value}</option>)}</ThemedSelect></label><label className="text-xs font-bold text-slate-700">အဖုံးအမျိုးအစား<ThemedSelect value={capForm.capProductKey || capForm.color} onChange={(event) => { const item = CAP_ITEMS.find((candidate) => candidate.productKey === event.target.value); const piece = isPieceCapProduct(item); setCapForm({ ...capForm, capProductKey: item?.productKey || "", capProductName: item?.productName || `အဖုံး - ${event.target.value}`, color: item ? String(item.productName).replace(/^အဖုံး\s*-\s*/, "") : event.target.value, packSize: piece ? "1" : capForm.packSize }); }} className="mt-1 h-10 w-full rounded-lg border border-violet-200 bg-white px-2 text-sm font-bold">{CAP_ITEMS.map((item) => <option key={item.productKey} value={item.productKey}>{item.productName}</option>)}</ThemedSelect></label><label className="text-xs font-bold text-slate-700">{isPieceCapProduct(capForm.capProductKey) ? "အရေအတွက်" : "တစ်အိတ်ဆံ့"}{isPieceCapProduct(capForm.capProductKey) ? <input type="number" min="1" step="1" required value={capForm.packs} onChange={(event) => setCapForm({ ...capForm, packs: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-center text-sm font-black" placeholder="ဥပမာ 10" /> : <ThemedSelect value={capForm.packSize} onChange={(event) => setCapForm({ ...capForm, packSize: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 bg-white px-2 text-sm font-bold"><option value="5000">5000 ဆံ့ / အိတ်</option><option value="500">500 ဆံ့ / အိတ်</option><option value="100">100 ဆံ့ / အိတ်</option></ThemedSelect>}</label>{!isPieceCapProduct(capForm.capProductKey) ? <label className="text-xs font-bold text-slate-700">အိတ်အရေအတွက်<input type="number" min="1" step="1" required value={capForm.packs} onChange={(event) => setCapForm({ ...capForm, packs: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-center text-sm font-black" placeholder="ဥပမာ 38" /></label> : null}<label className="text-xs font-bold text-slate-700 sm:col-span-2">မှတ်ချက်<input value={capForm.note} onChange={(event) => setCapForm({ ...capForm, note: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-violet-200 px-2 text-sm" placeholder="လက်ရှိစာရင်း / အသစ်ရောက်" /></label><button disabled={saving} className="h-10 self-end rounded-lg bg-violet-700 px-4 text-sm font-black text-white hover:bg-violet-800 disabled:opacity-50">{saving ? "သိမ်းနေသည်..." : "Stock ထည့်သိမ်းမည်"}</button></form>{saveMessage ? <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{saveMessage}</p> : null}</section>
    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</div> : null}{loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">အဖုံးလက်ကျန် ရယူနေသည်...</div> : null}
    {!loading ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-pink-50 text-left text-xs font-black text-pink-900"><tr><th className="px-4 py-3">နေရာ · အဖုံးအရောင်</th><th className="px-4 py-3 text-right">ရောင်း/သုံးထွက်</th><th className="px-4 py-3 text-right">စာရင်းညှိဝင်</th><th className="px-4 py-3 text-right">လက်ကျန်ယူနစ်</th><th className="px-4 py-3 text-right">လက်ကျန်အဖုံး</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{caps.map((item) => <tr key={item.productKey}><td className="px-4 py-3 font-black text-slate-900">{item.productName}<p className="text-[11px] font-bold text-slate-500">{isPieceCapRow(item) ? "အရေအတွက်" : `${number(item.capacity)} ဆံ့ / အိတ်`}</p></td><td className="px-4 py-3 text-right font-bold text-rose-700">-{number(item.soldCards)} {isPieceCapRow(item) ? "ခု" : "အိတ်"}</td><td className="px-4 py-3 text-right font-bold text-slate-700">+{number(item.adjustmentCards)} {isPieceCapRow(item) ? "ခု" : "အိတ်"}</td><td className={`px-4 py-3 text-right text-base font-black ${Number(item.currentCards || 0) < 0 ? "text-rose-700" : "text-slate-900"}`}>{number(item.currentCards)} {isPieceCapRow(item) ? "ခု" : "အိတ်"}</td><td className="px-4 py-3 text-right font-black text-pink-900">{number(item.currentBottles)} ဖုံး</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => setSelectedKey(item.productKey)} className="rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 text-xs font-black text-pink-800">အသေးစိတ်</button></td></tr>)}</tbody></table></div></section> : null}
    {addedOpen ? <div className="fixed inset-0 z-[155] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddedOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="daily-cap-added-title" className="max-h-[85dvh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-w-xl"><div className="flex items-start justify-between gap-3 border-b border-emerald-100 bg-emerald-50 px-4 py-4"><div><h2 id="daily-cap-added-title" className="text-lg font-black text-slate-900">ယနေ့ အသစ်ထည့်သော အဖုံး</h2><p className="mt-1 text-sm font-bold text-emerald-800">စုစုပေါင်း {number(dailyCapAddedPieces)} ဖုံး</p></div><button type="button" onClick={() => setAddedOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">ပိတ်</button></div><div className="max-h-[65dvh] space-y-2 overflow-y-auto p-4">{dailyCapAdded.length ? dailyCapAdded.map((row) => <div key={`${row.name}-${row.capacity}`} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"><div><p className="font-black text-slate-900">{row.name}</p><p className="text-xs font-bold text-slate-500">{isPieceCapProduct(row.name) ? `${number(row.pieces)} ခု` : `${number(row.capacity)} ဆံ့ / အိတ် · ${number(row.packs)} အိတ်`}</p></div><p className="text-right text-base font-black text-emerald-700">+{number(row.pieces)} ဖုံး</p></div>) : <p className="py-8 text-center font-bold text-slate-500">ယနေ့ အသစ်ထည့်ထားသော Stock မရှိသေးပါ။</p>}</div></section></div> : null}
    {usageOpen ? <div className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUsageOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="daily-cap-usage-title" className="max-h-[85dvh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-w-xl"><div className="flex items-start justify-between gap-3 border-b border-rose-100 bg-rose-50 px-4 py-4"><div><h2 id="daily-cap-usage-title" className="text-lg font-black text-slate-900">ယနေ့ အဖုံးသုံးစွဲမှု</h2><p className="mt-1 text-sm font-bold text-rose-800">စုစုပေါင်း {number(dailyCapPieces)} ဖုံး</p></div><button type="button" onClick={() => setUsageOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">ပိတ်</button></div><div className="max-h-[65dvh] space-y-2 overflow-y-auto p-4">{dailyCapUsage.length ? dailyCapUsage.map((row) => <div key={`${row.name}-${row.capacity}`} className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50/60 p-3"><div><p className="font-black text-slate-900">{row.name}</p><p className="text-xs font-bold text-slate-500">{isPieceCapProduct(row.name) ? `${number(row.pieces)} ခု` : `${number(row.capacity)} ဆံ့ / အိတ် · ${number(row.packs)} အိတ်`}</p></div><p className="text-right text-base font-black text-rose-700">-{number(row.pieces)} ဖုံး</p></div>) : <p className="py-8 text-center font-bold text-slate-500">ယနေ့ သုံးစွဲမှု မရှိသေးပါ။</p>}</div></section></div> : null}
    {selected ? <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setSelectedKey(""); setEditingMovement(null); } }}><section role="dialog" aria-modal="true" aria-labelledby="cap-stock-detail-title" className="max-h-[90dvh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl"><div className="flex items-start justify-between gap-3 border-b border-pink-100 bg-pink-50 px-4 py-4"><div><h2 id="cap-stock-detail-title" className="text-lg font-black text-slate-900">{selected.productName} အသေးစိတ်</h2><p className="mt-1 text-sm font-bold text-pink-800">လက်ရှိ {isPieceCapRow(selected) ? `${number(selected.currentBottles)} ခု` : `${number(selected.currentCards)} အိတ် · ${number(selected.currentBottles)} ဖုံး`}</p></div><button type="button" onClick={() => { setSelectedKey(""); setEditingMovement(null); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600">ပိတ်</button></div><div className="max-h-[72dvh] space-y-2 overflow-y-auto p-4">{selectedMovements.length ? selectedMovements.map((movement, index) => { const isManual = movement.sourceType === "CAP_OPENING" && movement.movementType === "ADJUSTMENT_IN"; return <article key={`${movement.id || movement.sourceId || "movement"}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{movementLabel(movement.movementType)}</p><p className="text-xs text-slate-500">{movement.movementDate} · {movement.sourceType || "manual"}{movement.note ? ` · ${movement.note}` : ""}</p></div><p className={`text-right font-black ${Number(movement.quantityBottles) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{Number(movement.quantityBottles) > 0 ? "+" : ""}{isPieceCapRow(selected) ? `${number(movement.quantityBottles)} ခု` : `${number(Number(movement.quantityBottles || 0) / Number(movement.capacity || 1))} အိတ်`}<br /><span className="text-xs">{Number(movement.quantityBottles) > 0 ? "+" : ""}{number(movement.quantityBottles)} ဖုံး</span></p></div>{isManual ? <div className="mt-3 flex justify-end gap-2 border-t border-slate-200 pt-2"><button type="button" onClick={() => beginEdit(movement)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Edit</button><button type="button" disabled={saving} onClick={() => deleteMovement(movement)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">Delete</button></div> : <p className="mt-2 text-[11px] font-bold text-slate-500">ရောင်း/ထုတ်လုပ်မှုမှ အလိုအလျောက်တွက်ထားသော မှတ်တမ်း — တိုက်ရိုက်မပြင်နိုင်ပါ။</p>}</article>; }) : <p className="py-8 text-center font-bold text-slate-500">မှတ်တမ်းမရှိသေးပါ။</p>}</div></section></div> : null}
    {editingMovement ? <div className="fixed inset-0 z-[170] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="edit-cap-stock-title" className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 id="edit-cap-stock-title" className="text-lg font-black text-slate-900">အဖုံး Stock မှတ်တမ်း ပြင်ရန်</h2><p className="mt-1 text-xs font-bold text-slate-500">ဒီနေရာမှာ ပြင်တာက Manual Stock ထည့်မှတ်တမ်းကိုသာ ပြင်ပါမယ်။</p></div><button type="button" onClick={() => setEditingMovement(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold">ပိတ်</button></div><form onSubmit={updateMovement} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">ရက်စွဲ<input type="date" value={editForm.movementDate} onChange={(event) => setEditForm({ ...editForm, movementDate: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-2" /></label><label className="text-xs font-bold">နေရာ<ThemedSelect value={editForm.location} onChange={(event) => setEditForm({ ...editForm, location: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-2">{CAP_LOCATIONS.map((value) => <option key={value}>{value}</option>)}</ThemedSelect></label><label className="text-xs font-bold">အဖုံးအရောင်<ThemedSelect value={editForm.color} onChange={(event) => setEditForm({ ...editForm, color: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-2">{CAP_COLORS.map((value) => <option key={value}>{value}</option>)}</ThemedSelect></label><label className="text-xs font-bold">တစ်အိတ်ဆံ့<input type="number" min="1" value={editForm.packSize} onChange={(event) => setEditForm({ ...editForm, packSize: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-2" /></label><label className="text-xs font-bold">အိတ်အရေအတွက်<input type="number" min="1" required value={editForm.packs} onChange={(event) => setEditForm({ ...editForm, packs: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-2" /></label><label className="text-xs font-bold sm:col-span-2">မှတ်ချက်<input value={editForm.note} onChange={(event) => setEditForm({ ...editForm, note: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-2" /></label><div className="flex gap-2 sm:col-span-2"><button type="button" onClick={() => setEditingMovement(null)} className="flex-1 rounded-lg border py-2 font-bold">မလုပ်တော့ပါ</button><button disabled={saving} className="flex-1 rounded-lg bg-blue-700 py-2 font-black text-white">{saving ? "သိမ်းနေသည်..." : "ပြင်ပြီးသိမ်းမည်"}</button></div></form></section></div> : null}
  </div></main>;
}
