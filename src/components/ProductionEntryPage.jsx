'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BOTTLE_GROUPS, BOTTLE_ITEMS, getBottleGroup, getTubeItemsForMachine, MACHINES } from "@/lib/production-catalog";

const SAVED_WORKERS_KEY = "newLifeLedgerSavedProductionWorkers";

function todayMyanmar() {
  const now = new Date(Date.now() + (6 * 60 + 30) * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function initialLines() {
  return {};
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function entryIsBlue(entry) {
  const itemName = `${entry.bottleType || ""} ${entry.tubeColor || ""}`.toUpperCase();
  return itemName.includes("ပြာ") || itemName.includes("B") || itemName.includes("S+1") || itemName.includes("S+S");
}

export default function ProductionEntryPage() {
  const [reportDate, setReportDate] = useState(todayMyanmar);
  const [machineCode, setMachineCode] = useState("");
  const [category, setCategory] = useState("bottle");
  const [activeBottleGroup, setActiveBottleGroup] = useState("03-white");
  const [lines, setLines] = useState(initialLines);
  const [wasteQuantity, setWasteQuantity] = useState("0");
  const [wasteNote, setWasteNote] = useState("");
  const [involvedWorkers, setInvolvedWorkers] = useState([]);
  const [savedWorkers, setSavedWorkers] = useState([]);
  const [workerNameDraft, setWorkerNameDraft] = useState("");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedMachine = useMemo(() => MACHINES.find((machine) => machine.code === machineCode), [machineCode]);
  const tubeItems = useMemo(() => getTubeItemsForMachine(machineCode), [machineCode]);

  useEffect(() => {
    setActiveBottleGroup("03-white");
    setLines({});
  }, [machineCode, selectedMachine]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SAVED_WORKERS_KEY) || "[]");
      if (Array.isArray(stored)) setSavedWorkers(stored.filter(Boolean).slice(0, 30));
    } catch {
      setSavedWorkers([]);
    }
  }, []);

  const loadHistory = useCallback(async (date = reportDate) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/production-reports?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "မှတ်တမ်းရယူ၍မရပါ။");
      setHistory(Array.isArray(body.data) ? body.data : []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingHistory(false);
    }
  }, [reportDate]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const entries = useMemo(() => {
    if (category === "tube") {
      return tubeItems.map((item) => ({
        key: `${item.g}|${item.color}`,
        label: item.label,
        sub: `${item.pcsPerBag.toLocaleString()} ခု/အိတ်`,
        capacity: item.pcsPerBag,
        unit: "အိတ်",
        tubeG: item.g,
        tubeColor: item.color,
      }));
    }
    return BOTTLE_ITEMS.flatMap((item) => item.capacities.map((capacity) => ({
      key: `${item.type}|${capacity}`,
      label: item.type,
      sub: `${capacity} ဆံ့ (ကဒ်)`,
      capacity,
      unit: "ကဒ်",
      bottleType: item.type,
    })));
  }, [category, tubeItems]);

  const filledEntries = useMemo(() => entries
    .map((entry) => ({ ...entry, quantity: Math.max(0, Number(lines[entry.key] || 0)) }))
    .filter((entry) => entry.quantity > 0), [entries, lines]);
  const totalPieces = filledEntries.reduce((sum, entry) => sum + entry.quantity * entry.capacity, 0);
  const visibleEntries = category === "tube" ? entries : entries.filter((entry) => getBottleGroup(entry.bottleType) === activeBottleGroup);
  const groupCounts = useMemo(() => Object.fromEntries(BOTTLE_GROUPS.map((group) => [group.key, entries.filter((entry) => getBottleGroup(entry.bottleType) === group.key).length])), [entries]);
  const workerCodes = involvedWorkers;

  function handleCategoryChange(nextCategory) {
    setCategory(nextCategory);
    if (selectedMachine?.category && selectedMachine.category !== nextCategory) setMachineCode("");
  }

  function updateLine(key, value) {
    setLines((current) => ({ ...current, [key]: value }));
  }

  function toggleWorker(name) {
    setInvolvedWorkers((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  function addSavedWorker(event) {
    event.preventDefault();
    const name = workerNameDraft.trim();
    if (!name) return;
    const next = [...savedWorkers.filter((item) => item !== name), name].slice(-30);
    setSavedWorkers(next);
    setInvolvedWorkers((current) => current.includes(name) ? current : [...current, name]);
    setWorkerNameDraft("");
    localStorage.setItem(SAVED_WORKERS_KEY, JSON.stringify(next));
  }

  function resetForm() {
    setLines({});
    setWasteQuantity("0");
    setWasteNote("");
    setInvolvedWorkers([]);
    setNotes("");
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!machineCode) return setError("စက်ရွေးပေးပါ။");
    if (filledEntries.length === 0) return setError("ထွက်ရှိမှု အနည်းဆုံးတစ်ခု ဖြည့်ပေးပါ။");
    setSubmitting(true);
    try {
      const actorName = typeof window !== "undefined" ? localStorage.getItem("actorName") || "Staff" : "Staff";
      const response = await fetch("/api/production-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-actor-name": encodeURIComponent(actorName) },
        body: JSON.stringify({
          reportDate,
          machineCode,
          category,
          rows: filledEntries,
          wasteQuantity,
          wasteNote,
          involvedWorkers: workerCodes,
          notes,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "တင်သွင်း၍မရပါ။");
      setMessage(`${body.data.lineCount} မျိုး၊ ${formatNumber(body.data.totalPieces)} ခု အောင်မြင်စွာ တင်ပြီးပါပြီ။`);
      resetForm();
      await loadHistory(reportDate);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const groupedHistory = useMemo(() => {
    const groups = new Map();
    history.forEach((row) => {
      const key = row.submissionId || row.id;
      const group = groups.get(key) || { ...row, rows: [], totalPieces: 0 };
      group.rows.push(row);
      group.totalPieces += Number(row.outputQuantity || 0) * Number(row.outputCapacity || 0);
      groups.set(key, group);
    });
    return [...groups.values()];
  }, [history]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-5 bg-slate-50 px-3 py-5 sm:px-6">
      <header className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
        <Link href="/" className="text-sm font-semibold text-cyan-700">← Dashboard</Link>
        <h1 className="mt-2 text-2xl font-black text-slate-900">ထွက်ရှိမှု မှတ်တမ်းတင်ရန်</h1>
        <p className="mt-1 text-sm text-slate-600">အဆိုင်းပြီးတဲ့အခါ စက်ထွက်ရှိမှု၊ ပျက်စီးမှုနှင့် ပူးတွဲဆင်းသူများ ထည့်ပါ။</p>
      </header>

      <form onSubmit={submit} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-800">အခြေခံ အချက်အလက်</h2>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-2 text-sm font-bold text-slate-700"><span>အမျိုးအစား</span>
              <select value={category} onChange={(event) => handleCategoryChange(event.target.value)} className="h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 font-semibold leading-none">
                <option value="bottle">ဗူးခွံ</option><option value="tube">Tube</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm font-bold text-slate-700"><span>စက်</span>
              <select value={machineCode} onChange={(event) => setMachineCode(event.target.value)} className="h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 font-semibold leading-none">
                <option value="">စက်ရွေးချယ်ရန်</option>
                {MACHINES.filter((machine) => !machine.category || machine.category === category).map((machine) => <option key={machine.code} value={machine.code}>{machine.code} — {machine.name}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-2 overflow-hidden text-sm font-bold text-slate-700"><span>နေ့စွဲ</span>
              <span className="block min-w-0 max-w-full overflow-hidden rounded-xl"><input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} style={{ minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }} className="box-border block h-12 min-h-12 min-w-0 max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-center font-semibold leading-normal align-middle" /></span>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-700">ထွက်ရှိမှု စာရင်း</h2>
          {category === "bottle" ? <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{BOTTLE_GROUPS.map((group) => <button type="button" key={group.key} onClick={() => setActiveBottleGroup(group.key)} className={`min-w-0 rounded-xl border p-3 text-left transition ${activeBottleGroup === group.key ? "border-teal-700 bg-teal-700 text-white shadow-md" : "border-teal-100 bg-teal-50 text-teal-900 hover:border-teal-300"}`}><span className="block truncate text-sm font-black">{group.label}</span><span className={`mt-1 block text-[11px] leading-4 ${activeBottleGroup === group.key ? "text-teal-100" : "text-teal-700"}`}>{groupCounts[group.key] || 0} မျိုး</span></button>)}</div> : <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-800">Tube စက်အလိုက် ထုတ်လုပ်နိုင်သောအမျိုးအစားများ</div>}
          {category === "bottle" ? <p className="mb-3 text-xs font-semibold text-slate-500">{BOTTLE_GROUPS.find((group) => group.key === activeBottleGroup)?.description} — သက်ဆိုင်ရာ size များကိုသာ ပြထားပါသည်။</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEntries.map((entry) => {
              const isBlue = entryIsBlue(entry);
              return <label key={entry.key} className={`rounded-xl border p-3 text-sm font-bold shadow-sm ${isBlue ? "border-sky-200 bg-sky-50 text-sky-950" : "border-slate-300 bg-white text-slate-900"}`}>
                <span className="flex items-center justify-between gap-2"><span className="min-w-0 text-base font-black leading-tight">{entry.label}</span><span className={`shrink-0 rounded-full px-2 py-1 text-sm font-black ${isBlue ? "border border-sky-300 bg-sky-100 text-sky-800" : "border border-slate-400 bg-slate-50 text-slate-700"}`}>{entry.capacity.toLocaleString()} {category === "tube" ? "ခု/အိတ်" : "ဆံ့"}</span></span>
                <span className="mt-2 flex items-center gap-2 text-xs font-bold"><span className={`rounded-full border px-2 py-0.5 ${isBlue ? "border-sky-300 bg-sky-100 text-sky-800" : "border-slate-400 bg-slate-100 text-slate-700"}`}>{isBlue ? "ပြာ" : "ဖြူ"}</span><span className={isBlue ? "text-sky-700" : "text-slate-600"}>{category === "tube" ? entry.sub : `ကဒ်အရေအတွက် — ${entry.capacity.toLocaleString()} ဆံ့`}</span></span>
                <input type="number" min="0" step="1" value={lines[entry.key] || ""} onChange={(event) => updateLine(entry.key, event.target.value)} placeholder="0" className={`mt-2 w-full rounded-lg border-2 bg-white p-3 text-right text-lg font-black outline-none ${isBlue ? "border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100" : "border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-200"}`} />
              </label>;
            })}
          </div>
          <div className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 text-center"><div className="text-xs font-bold text-emerald-700">စုစုပေါင်း ထွက်ရှိ</div><div className="text-3xl font-black text-emerald-800">{formatNumber(totalPieces)} <span className="text-sm">ခု</span></div><div className="text-xs text-emerald-700">{filledEntries.length} မျိုး ဖြည့်ထား</div></div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm"><h2 className="mb-3 text-lg font-black text-red-800">ပျက်စီးမှု</h2><label className="text-sm font-bold text-slate-700">ပျက်စီးသွားသော ခုရေအတိအကျ<input type="number" min="0" step="1" value={wasteQuantity} onChange={(event) => setWasteQuantity(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-bold" /></label><label className="mt-3 block text-sm font-bold text-slate-700">အကြောင်းအရင်း<input value={wasteNote} onChange={(event) => setWasteNote(event.target.value)} placeholder="အကြောင်းအရင်း" className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label></div>
          <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm"><h2 className="mb-3 text-lg font-black text-blue-800">ပူးတွဲဆင်းသူများ ({workerCodes.length})</h2><div className="flex min-h-10 flex-wrap gap-2">{savedWorkers.length ? savedWorkers.map((name) => <button type="button" key={name} onClick={() => toggleWorker(name)} className={`rounded-full border px-4 py-2 text-sm font-black ${involvedWorkers.includes(name) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>{name}</button>) : <span className="text-sm text-slate-500">နာမည်သိမ်းထားခြင်း မရှိသေးပါ</span>}</div><div className="mt-3 flex gap-2"><input value={workerNameDraft} onChange={(event) => setWorkerNameDraft(event.target.value)} placeholder="Worker နာမည်ထည့်ပါ" className="min-w-0 flex-1 rounded-xl border border-slate-300 p-3" /><button type="button" onClick={addSavedWorker} className="shrink-0 rounded-xl bg-blue-600 px-4 py-3 font-black text-white hover:bg-blue-700">ထည့် +</button></div><p className="mt-2 text-xs text-slate-500">ပထမအကြိမ် နာမည်ထည့်ပြီး သိမ်းထားပါ။ နောက်တစ်ခါတွင် နာမည်ကို နှိပ်ရုံဖြင့် ရွေးနိုင်ပါသည်။</p></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><label className="text-sm font-bold text-slate-700">အခြားမှတ်ချက်<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="ထပ်ဖြည့်ချင်တာရှိရင် ရေးပါ" rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label></section>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 font-bold text-red-700">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-700">{message}</div>}
        <button disabled={submitting} className="w-full rounded-xl bg-orange-500 px-4 py-4 text-lg font-black text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "တင်နေပါသည်..." : `တင်သွင်းရန် (${filledEntries.length} မျိုး)`}</button>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black text-slate-800">ထွက်ရှိမှုမှတ်တမ်းများ</h2><span className="text-xs text-slate-500">{loadingHistory ? "ရယူနေသည်..." : `${groupedHistory.length} ကြိမ်`}</span></div>{groupedHistory.length === 0 && !loadingHistory ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">ထွက်ရှိမှုမှတ်တမ်း မရှိသေးပါ</p> : <div className="space-y-3">{groupedHistory.map((group) => <div key={group.submissionId || group.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-black text-slate-800">{group.machineCode} — {group.machineName}</div><div className="text-xs text-slate-500">{group.reportDate} · {group.actorName}</div></div><div className="mt-2 flex flex-wrap gap-2 text-sm">{group.rows.map((row) => <span key={row.id} className="rounded-lg bg-white px-2 py-1 font-semibold">{row.category === "tube" ? `${row.tubeG} ${row.tubeColor}` : row.bottleType} · {row.outputQuantity} {row.outputUnit} × {row.outputCapacity}</span>)}</div><div className="mt-2 text-sm font-black text-emerald-700">စုစုပေါင်း {formatNumber(group.totalPieces)} ခု · ပျက်စီး {formatNumber(group.wasteQuantity)} ခု</div></div>)}</div>}</section>
    </main>
  );
}
