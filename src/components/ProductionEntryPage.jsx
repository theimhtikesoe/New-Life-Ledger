'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BOTTLE_GROUPS, BOTTLE_ITEMS, getBottleGroup, getTubeItemsForMachine, MACHINES } from "@/lib/production-catalog";

const CO_WORKERS = ["HO", "RZ", "WB"];

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

export default function ProductionEntryPage() {
  const [reportDate, setReportDate] = useState(todayMyanmar);
  const [machineCode, setMachineCode] = useState("");
  const [category, setCategory] = useState("bottle");
  const [activeBottleGroup, setActiveBottleGroup] = useState("03-white");
  const [lines, setLines] = useState(initialLines);
  const [wasteQuantity, setWasteQuantity] = useState("0");
  const [wasteNote, setWasteNote] = useState("");
  const [involvedWorkers, setInvolvedWorkers] = useState([]);
  const [customWorkers, setCustomWorkers] = useState("");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedMachine = useMemo(() => MACHINES.find((machine) => machine.code === machineCode), [machineCode]);
  const tubeItems = useMemo(() => getTubeItemsForMachine(machineCode), [machineCode]);

  useEffect(() => {
    if (selectedMachine?.category === "tube") setCategory("tube");
    if (selectedMachine?.category === "bottle") setCategory("bottle");
    setActiveBottleGroup("03-white");
    setLines({});
  }, [machineCode, selectedMachine]);

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
  const workerCodes = [...involvedWorkers, ...customWorkers.split(",").map((value) => value.trim()).filter(Boolean)];

  function updateLine(key, value) {
    setLines((current) => ({ ...current, [key]: value }));
  }

  function toggleWorker(code) {
    setInvolvedWorkers((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  function resetForm() {
    setLines({});
    setWasteQuantity("0");
    setWasteNote("");
    setInvolvedWorkers([]);
    setCustomWorkers("");
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
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-bold text-slate-700">အမျိုးအစား
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-semibold">
                <option value="bottle">ဗူးခွံ</option><option value="tube">Tube</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">စက်
              <select value={machineCode} onChange={(event) => setMachineCode(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-semibold">
                <option value="">စက်ရွေးချယ်ရန်</option>
                {MACHINES.filter((machine) => !machine.category || machine.category === category).map((machine) => <option key={machine.code} value={machine.code}>{machine.code} — {machine.name}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-sm font-bold text-slate-700">နေ့စွဲ
              <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="mt-1 block min-w-0 w-full max-w-full appearance-none rounded-xl border border-slate-300 bg-white p-3 font-semibold" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-violet-800">ထွက်ရှိမှု စာရင်း</h2>
          {category === "bottle" ? <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{BOTTLE_GROUPS.map((group) => <button type="button" key={group.key} onClick={() => setActiveBottleGroup(group.key)} className={`min-w-0 rounded-xl border p-3 text-left transition ${activeBottleGroup === group.key ? "border-violet-600 bg-violet-600 text-white shadow-md" : "border-violet-100 bg-violet-50 text-violet-800 hover:border-violet-300"}`}><span className="block truncate text-sm font-black">{group.label}</span><span className={`mt-1 block text-[11px] leading-4 ${activeBottleGroup === group.key ? "text-violet-100" : "text-violet-600"}`}>{groupCounts[group.key] || 0} မျိုး</span></button>)}</div> : <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-800">Tube စက်အလိုက် ထုတ်လုပ်နိုင်သောအမျိုးအစားများ</div>}
          {category === "bottle" ? <p className="mb-3 text-xs font-semibold text-slate-500">{BOTTLE_GROUPS.find((group) => group.key === activeBottleGroup)?.description} — သက်ဆိုင်ရာ size များကိုသာ ပြထားပါသည်။</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEntries.map((entry) => <label key={entry.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-800">
              <span className="block">{entry.label}</span><span className="text-xs font-medium text-slate-500">{entry.sub}</span>
              <input type="number" min="0" step="1" value={lines[entry.key] || ""} onChange={(event) => updateLine(entry.key, event.target.value)} placeholder="0" className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 text-right font-black" />
            </label>)}
          </div>
          <div className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 text-center"><div className="text-xs font-bold text-emerald-700">စုစုပေါင်း ထွက်ရှိ</div><div className="text-3xl font-black text-emerald-800">{formatNumber(totalPieces)} <span className="text-sm">ခု</span></div><div className="text-xs text-emerald-700">{filledEntries.length} မျိုး ဖြည့်ထား</div></div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm"><h2 className="mb-3 text-lg font-black text-red-800">ပျက်စီးမှု</h2><label className="text-sm font-bold text-slate-700">ပျက်စီးသွားသော ခုရေအတိအကျ<input type="number" min="0" step="1" value={wasteQuantity} onChange={(event) => setWasteQuantity(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-bold" /></label><label className="mt-3 block text-sm font-bold text-slate-700">အကြောင်းအရင်း<input value={wasteNote} onChange={(event) => setWasteNote(event.target.value)} placeholder="အကြောင်းအရင်း" className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label></div>
          <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm"><h2 className="mb-3 text-lg font-black text-blue-800">ပူးတွဲဆင်းသူများ ({workerCodes.length})</h2><div className="flex flex-wrap gap-2">{CO_WORKERS.map((code) => <button type="button" key={code} onClick={() => toggleWorker(code)} className={`rounded-full border px-4 py-2 text-sm font-black ${involvedWorkers.includes(code) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>{code}</button>)}</div><label className="mt-3 block text-sm font-bold text-slate-700">အခြား Worker code များ (comma ဖြင့်ခွဲပါ)<input value={customWorkers} onChange={(event) => setCustomWorkers(event.target.value)} placeholder="ဥပမာ HO, RZ" className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label></div>
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
