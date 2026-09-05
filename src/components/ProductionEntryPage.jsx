'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOTTLE_GROUPS, BOTTLE_ITEMS, getBottleGroup, getTubeItemsForMachine, MACHINES } from "@/lib/production-catalog";

function todayMyanmar() {
  const now = new Date(Date.now() + (6 * 60 + 30) * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function entryIsBlue(entry) {
  const itemName = `${entry.bottleType || ""} ${entry.tubeColor || ""}`.toUpperCase();
  return itemName.includes("ပြာ") || itemName.includes("B") || itemName.includes("S+1") || itemName.includes("S+S");
}

function shiftDateValue(value, delta) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function RequiredLabel({ children }) {
  return <span>{children} <span className="text-red-600" aria-label="လိုအပ်သည်">*</span></span>;
}

function OptionalLabel({ children }) {
  return <span>{children} <span className="font-normal text-slate-400">(မဖြည့်လည်းရ)</span></span>;
}

export default function ProductionEntryPage() {
  const today = todayMyanmar();
  const [reportDate, setReportDate] = useState(today);
  const [historyDate, setHistoryDate] = useState(today);
  const [machineCode, setMachineCode] = useState("");
  const [category, setCategory] = useState("bottle");
  const [activeBottleGroup, setActiveBottleGroup] = useState("03-white");
  const [lines, setLines] = useState({});
  const [wasteQuantity, setWasteQuantity] = useState("0");
  const [wasteNote, setWasteNote] = useState("");
  const [involvedWorkers, setInvolvedWorkers] = useState([]);
  const [savedWorkers, setSavedWorkers] = useState([]);
  const [workerNameDraft, setWorkerNameDraft] = useState("");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState([]);
  const [editingSubmissionId, setEditingSubmissionId] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const workerPressTimerRef = useRef(null);
  const suppressWorkerClickRef = useRef(false);

  const selectedMachine = useMemo(() => MACHINES.find((machine) => machine.code === machineCode), [machineCode]);
  const tubeItems = useMemo(() => getTubeItemsForMachine(machineCode), [machineCode]);

  useEffect(() => {
    setActiveBottleGroup("03-white");
    setLines({});
  }, [machineCode, selectedMachine]);

  const loadWorkers = useCallback(async () => {
    setLoadingWorkers(true);
    try {
      const response = await fetch("/api/production-workers", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Worker စာရင်း ရယူ၍မရပါ။");
      setSavedWorkers(Array.isArray(body.data) ? body.data : []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingWorkers(false);
    }
  }, []);

  const loadHistory = useCallback(async (date = historyDate) => {
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
  }, [historyDate]);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const entries = useMemo(() => {
    if (category === "tube") {
      return tubeItems.map((item) => ({
        key: `${item.g}|${item.color}`,
        label: item.label,
        sub: `${item.pcsPerBag.toLocaleString()} ဗူး/အိတ်`,
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
    .map((entry) => {
      const quantity = Math.max(0, Number(lines[entry.key] || 0));
      return { ...entry, quantity, outputQuantity: quantity, outputCapacity: entry.capacity };
    })
    .filter((entry) => entry.quantity > 0), [entries, lines]);
  const totalPieces = filledEntries.reduce((sum, entry) => sum + entry.quantity * entry.capacity, 0);
  const totalCards = filledEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const damagedPieces = Math.max(0, Number(wasteQuantity || 0));
  const goodPieces = Math.max(0, totalPieces - damagedPieces);
  const visibleEntries = category === "tube" ? entries : entries.filter((entry) => getBottleGroup(entry.bottleType) === activeBottleGroup);
  const groupCounts = useMemo(() => Object.fromEntries(BOTTLE_GROUPS.map((group) => [group.key, entries.filter((entry) => getBottleGroup(entry.bottleType) === group.key).length])), [entries]);
  const summaryByType = useMemo(() => {
    const result = new Map();
    filledEntries.forEach((entry) => {
      const key = category === "tube" ? `${entry.tubeG} ${entry.tubeColor}` : entry.bottleType;
      const current = result.get(key) || { label: key, cards: 0, pieces: 0 };
      current.cards += entry.quantity;
      current.pieces += entry.quantity * entry.capacity;
      result.set(key, current);
    });
    return [...result.values()];
  }, [category, filledEntries]);
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

  async function addSavedWorker(event) {
    event.preventDefault();
    const name = workerNameDraft.trim();
    if (!name) return setError("Worker နာမည်ထည့်ပေးပါ။");
    setError("");
    try {
      const actorName = localStorage.getItem("actorName") || "Staff";
      const response = await fetch("/api/production-workers", { method: "POST", headers: { "Content-Type": "application/json", "x-actor-name": encodeURIComponent(actorName) }, body: JSON.stringify({ name }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Worker ထည့်၍မရပါ။");
      setWorkerNameDraft("");
      setInvolvedWorkers((current) => current.includes(name) ? current : [...current, name]);
      await loadWorkers();
    } catch (addError) {
      setError(addError.message);
    }
  }

  function startWorkerLongPress(name, id) {
    suppressWorkerClickRef.current = false;
    workerPressTimerRef.current = window.setTimeout(async () => {
      suppressWorkerClickRef.current = true;
      if (!window.confirm(`${name}\n\nShared Worker စာရင်းမှ ဖယ်ရှားမလား?`)) return;
      try {
        const actorName = localStorage.getItem("actorName") || "Staff";
        const response = await fetch(`/api/production-workers?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-actor-name": encodeURIComponent(actorName) } });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Worker ဖယ်၍မရပါ။");
        setInvolvedWorkers((current) => current.filter((item) => item !== name));
        await loadWorkers();
      } catch (deleteError) {
        setError(deleteError.message);
      }
    }, 750);
  }

  function endWorkerLongPress() {
    if (workerPressTimerRef.current) window.clearTimeout(workerPressTimerRef.current);
    workerPressTimerRef.current = null;
  }

  function resetForm() {
    setLines({});
    setWasteQuantity("0");
    setWasteNote("");
    setInvolvedWorkers([]);
    setNotes("");
  }

  function entryKeyForRow(row) {
    return row.category === "tube" ? `${row.tubeG}|${row.tubeColor}` : `${row.bottleType}|${row.outputCapacity}`;
  }

  function startEdit(group) {
    const first = group.rows[0];
    setEditingSubmissionId(group.submissionId || group.id);
    setReportDate(group.reportDate);
    setMachineCode(group.machineCode);
    setCategory(first.category);
    setLines(Object.fromEntries(group.rows.map((row) => [entryKeyForRow(row), String(row.outputQuantity)])));
    setWasteQuantity(String(group.wasteQuantity || 0));
    setWasteNote(group.wasteNote || "");
    setInvolvedWorkers(Array.isArray(first.involvedWorkers) ? first.involvedWorkers : []);
    setNotes(first.notes || "");
    setMessage("ဒီ report ကို အပေါ်မှာ ပြန်ပြင်နိုင်ပါပြီ။");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingSubmissionId("");
    resetForm();
    setMessage("");
  }

  async function deleteReport(group) {
    const submissionId = group.submissionId || group.id;
    if (!window.confirm("ဒီထုတ်လုပ်မှုမှတ်တမ်းကို ဖျက်မှာ သေချာပါသလား။")) return;
    setError("");
    try {
      const response = await fetch(`/api/production-reports?submissionId=${encodeURIComponent(submissionId)}`, { method: "DELETE", headers: { "x-actor-name": encodeURIComponent(localStorage.getItem("actorName") || "Staff") } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "ဖျက်၍မရပါ။");
      if (editingSubmissionId === submissionId) cancelEdit();
      setHistoryDate(reportDate);
      await loadHistory(reportDate);
      setMessage("ထုတ်လုပ်မှုမှတ်တမ်းကို ဖျက်ပြီးပါပြီ။");
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!machineCode) return setError("စက် * ကို ရွေးပေးပါ။");
    if (reportDate > today) return setError("အနာဂတ်ရက်စွဲဖြင့် သိမ်း၍မရပါ။");
    if (filledEntries.length === 0) return setError("ထွက်ရှိမှုအရေအတွက် * အနည်းဆုံးတစ်မျိုး ဖြည့်ပေးပါ။");
    if (damagedPieces > 0 && !wasteNote.trim()) return setError("ပျက်စီးမှုရှိသောကြောင့် အကြောင်းရင်းကို မဖြည့်မနေရ ထည့်ပေးပါ။");
    const typeLines = summaryByType.map((item) => `${item.label}: ${formatNumber(item.cards)} ကဒ် / ${formatNumber(item.pieces)} ဗူး`).join("\n");
    const summary = `နေ့စွဲ: ${reportDate}\nအမျိုးအစား: ${category === "tube" ? "Tube" : "ဗူးခွံ"}\nစက်: ${machineCode}\n\n${typeLines}\n\nစုစုပေါင်း: ${formatNumber(totalPieces)} ဗူး\nပျက်စီး: ${formatNumber(damagedPieces)} ဗူး\nကောင်းမွန်: ${formatNumber(goodPieces)} ဗူး`;
    if (!window.confirm(`သိမ်းမည့် Production Report အကျဉ်းချုပ်\n\n${summary}\n\nဆက်လက်တင်သွင်းမလား?`)) return;
    setSubmitting(true);
    try {
      const actorName = localStorage.getItem("actorName") || "Staff";
      const response = await fetch("/api/production-reports", {
        method: editingSubmissionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "x-actor-name": encodeURIComponent(actorName) },
        body: JSON.stringify({ reportDate, ...(editingSubmissionId ? { submissionId: editingSubmissionId } : {}), machineCode, category, rows: filledEntries, wasteQuantity, wasteNote, involvedWorkers, notes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "တင်သွင်း၍မရပါ။");
      setMessage(`${body.data.lineCount} မျိုး၊ ${formatNumber(body.data.totalPieces)} ဗူး ${editingSubmissionId ? "Update ပြီးပါပြီ" : "အောင်မြင်စွာ တင်ပြီးပါပြီ"}။`);
      setEditingSubmissionId("");
      resetForm();
      setHistoryDate(reportDate);
      await loadHistory(reportDate);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="production-page mx-auto min-h-screen w-full max-w-none space-y-3 bg-white px-2 py-3 sm:space-y-5 sm:px-6 sm:py-5 lg:max-w-6xl">
      <header className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
        <Link href="/" className="text-sm font-semibold text-cyan-700">← Dashboard</Link>
        <h1 className="mt-2 text-2xl font-black text-slate-900">ထွက်ရှိမှု မှတ်တမ်းတင်ရန်</h1>
        <p className="mt-1 text-sm text-slate-600">မဖြည့်မနေရ field များကို <span className="font-black text-red-600">*</span> ဖြင့်ပြထားပြီး `(မဖြည့်လည်းရ)` သည် optional field ဖြစ်ပါသည်။</p>
      </header>

      <form onSubmit={submit} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-800">အခြေခံ အချက်အလက်</h2>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-2 rounded-2xl border-2 border-violet-200 bg-violet-50 p-4 text-base font-black text-violet-950 shadow-sm"><span className="text-lg">အမျိုးအစား <span className="font-normal text-slate-400">(ပုံမှန် ဗူးခွံ)</span></span><select value={category} onChange={(event) => handleCategoryChange(event.target.value)} className="h-14 w-full rounded-xl border-2 border-violet-300 bg-white px-3 text-lg font-black"><option value="bottle">ဗူးခွံ</option><option value="tube">Tube</option></select></label>
            <label className="flex min-w-0 flex-col gap-2 rounded-2xl border-2 border-orange-200 bg-orange-50 p-4 text-base font-black text-orange-950 shadow-sm"><RequiredLabel>စက်</RequiredLabel><select value={machineCode} onChange={(event) => setMachineCode(event.target.value)} className="h-14 w-full rounded-xl border-2 border-orange-300 bg-white px-3 text-lg font-black"><option value="">စက်ရွေးချယ်ရန်</option>{MACHINES.filter((machine) => !machine.category || machine.category === category).map((machine) => <option key={machine.code} value={machine.code}>{machine.code} — {machine.name}</option>)}</select></label>
            <label className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-4 text-base font-black text-cyan-950 shadow-sm"><RequiredLabel>နေ့စွဲ</RequiredLabel><span className="flex min-w-0 gap-1"><button type="button" onClick={() => setReportDate((value) => shiftDateValue(value, -1))} className="rounded-lg border-2 border-cyan-300 bg-white px-3 text-2xl font-black">‹</button><input type="date" max={today} value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="box-border h-14 min-w-0 flex-1 rounded-xl border-2 border-cyan-300 bg-white px-2 text-center text-lg font-black" /><button type="button" disabled={reportDate >= today} onClick={() => setReportDate((value) => shiftDateValue(value, 1))} className="rounded-lg border-2 border-cyan-300 bg-white px-3 text-2xl font-black disabled:opacity-40">›</button></span></label>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-2xl font-black text-slate-800">ထွက်ရှိမှု စာရင်း <span className="text-red-600">*</span></h2>
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900"><span className="font-black">မဖြည့်မနေရ —</span> စက်ရွေးပြီး size card အနည်းဆုံးတစ်မျိုးမှာ အရေအတွက်ထည့်ပါ။ `ဆံ့` ပမာဏက card ထဲမှာ သတ်မှတ်ပြီးသားဖြစ်ပါတယ်။</p>
          {category === "bottle" ? <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{BOTTLE_GROUPS.map((group) => <button type="button" key={group.key} onClick={() => setActiveBottleGroup(group.key)} className={`min-w-0 rounded-xl border p-3 text-left transition ${activeBottleGroup === group.key ? "border-teal-700 bg-teal-700 text-white shadow-md" : "border-teal-100 bg-teal-50 text-teal-900 hover:border-teal-300"}`}><span className="block truncate text-sm font-black">{group.label}</span><span className={`mt-1 block text-[11px] ${activeBottleGroup === group.key ? "text-teal-100" : "text-teal-700"}`}>{groupCounts[group.key] || 0} မျိုး</span></button>)}</div> : <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-800">Tube စက်အလိုက် ထုတ်လုပ်နိုင်သောအမျိုးအစားများ</div>}
          {category === "bottle" ? <p className="mb-3 text-xs font-semibold text-slate-500">{BOTTLE_GROUPS.find((group) => group.key === activeBottleGroup)?.description} — သက်ဆိုင်ရာ size များကိုသာ ပြထားပါသည်။</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleEntries.map((entry) => { const isBlue = entryIsBlue(entry); return <label key={entry.key} className={`rounded-2xl border-2 p-4 text-base font-bold shadow-sm ${isBlue ? "border-sky-200 bg-sky-50 text-sky-950" : "border-slate-300 bg-white text-slate-900"}`}><span className="flex items-center justify-between gap-2"><span className="min-w-0 text-lg font-black leading-tight">{entry.label}</span><span className={`shrink-0 rounded-full px-3 py-1 text-base font-black ${isBlue ? "border border-sky-300 bg-sky-100 text-sky-800" : "border border-slate-400 bg-slate-50 text-slate-700"}`}>{entry.capacity.toLocaleString()} {category === "tube" ? "ဗူး/အိတ်" : "ဆံ့"}</span></span><span className="mt-2 flex items-center gap-2 text-sm font-bold"><span className={`rounded-full border px-2 py-0.5 ${isBlue ? "border-sky-300 bg-sky-100 text-sky-800" : "border-slate-400 bg-slate-100 text-slate-700"}`}>{isBlue ? "ပြာ" : "ဖြူ"}</span><span>{category === "tube" ? entry.sub : `ကဒ်အရေအတွက် — ${entry.capacity.toLocaleString()} ဆံ့`}</span></span><input type="number" min="0" step="1" value={lines[entry.key] || ""} onChange={(event) => updateLine(entry.key, event.target.value)} placeholder="0" className={`mt-2 w-full rounded-xl border-2 bg-white p-4 text-right text-2xl font-black outline-none ${isBlue ? "border-sky-300 focus:border-sky-500" : "border-slate-300 focus:border-slate-600"}`} /></label>; })}</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 text-center"><div className="text-xs font-bold text-emerald-700">စုစုပေါင်းထွက်ရှိ</div><div className="text-2xl font-black text-emerald-800">{formatNumber(totalPieces)} <span className="text-sm">ဗူး</span></div><div className="text-xs text-emerald-700">{formatNumber(totalCards)} ကဒ်/အိတ်</div></div><div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-center"><div className="text-xs font-bold text-red-700">ပျက်စီးမှု</div><div className="text-2xl font-black text-red-800">{formatNumber(damagedPieces)} <span className="text-sm">ဗူး</span></div></div><div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-center"><div className="text-xs font-bold text-blue-700">ကောင်းမွန်ထွက်ရှိ</div><div className="text-2xl font-black text-blue-800">{formatNumber(goodPieces)} <span className="text-sm">ဗူး</span></div></div></div>
          {summaryByType.length ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><h3 className="mb-2 font-black text-slate-800">အမျိုးအစားအလိုက် စုစုပေါင်း</h3><div className="grid gap-2 sm:grid-cols-2">{summaryByType.map((item) => <div key={item.label} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm"><span className="font-bold text-slate-700">{item.label}</span><span className="text-right font-black text-slate-900">{formatNumber(item.cards)} ကဒ် · {formatNumber(item.pieces)} ဗူး</span></div>)}</div></div> : null}
        </section>

        <section className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm"><h2 className="mb-3 text-lg font-black text-red-800">ပျက်စီးမှု <span className="font-normal text-slate-400">(မဖြည့်လည်းရ)</span></h2><label className="text-sm font-bold text-slate-700"><OptionalLabel>ပျက်စီးသွားသော ဗူးရေအတိအကျ</OptionalLabel><input type="number" min="0" step="1" value={wasteQuantity} onChange={(event) => setWasteQuantity(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-bold" /></label><label className="mt-3 block text-sm font-bold text-slate-700"><span>အကြောင်းရင်း {damagedPieces > 0 ? <span className="text-red-600">*</span> : <span className="font-normal text-slate-400">(ပျက်စီးမှုရှိမှ ဖြည့်ရန်)</span>}</span><input value={wasteNote} onChange={(event) => setWasteNote(event.target.value)} placeholder={damagedPieces > 0 ? "ပျက်စီးရခြင်းအကြောင်းရင်း ထည့်ပါ" : "ပျက်စီးမှုမရှိလျှင် မဖြည့်လည်းရ"} className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label></div>
          <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm"><h2 className="mb-3 text-lg font-black text-blue-800">ပူးတွဲဆင်းသူများ <span className="font-normal text-slate-400">(မဖြည့်လည်းရ)</span> ({involvedWorkers.length})</h2><div className="flex min-h-10 flex-wrap gap-2">{loadingWorkers ? <span className="text-sm text-slate-500">Worker စာရင်း ရယူနေသည်...</span> : savedWorkers.length ? savedWorkers.map((worker) => <button type="button" key={worker.id} onClick={() => { if (suppressWorkerClickRef.current) { suppressWorkerClickRef.current = false; return; } toggleWorker(worker.name); }} onPointerDown={() => startWorkerLongPress(worker.name, worker.id)} onPointerUp={endWorkerLongPress} onPointerLeave={endWorkerLongPress} onContextMenu={(event) => event.preventDefault()} className={`rounded-full border px-4 py-2 text-sm font-black ${involvedWorkers.includes(worker.name) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>{worker.name}</button>) : <span className="text-sm text-slate-500">နာမည်သိမ်းထားခြင်း မရှိသေးပါ</span>}</div><div className="mt-3 flex gap-2"><input value={workerNameDraft} onChange={(event) => setWorkerNameDraft(event.target.value)} placeholder="Worker နာမည်အသစ်ထည့်ပါ" className="min-w-0 flex-1 rounded-xl border border-slate-300 p-3" /><button type="button" onClick={addSavedWorker} className="shrink-0 rounded-xl bg-blue-600 px-4 py-3 font-black text-white">ထည့် +</button></div><p className="mt-2 text-xs text-slate-500">တစ်ချက်နှိပ်လျှင် ရွေး/ဖြုတ်၊ ကြာကြာဖိထားလျှင် shared list မှ ဖယ်ရှားနိုင်ပါသည်။</p></div></section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><label className="text-sm font-bold text-slate-700"><OptionalLabel>အခြားမှတ်ချက်</OptionalLabel><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="ထပ်ဖြည့်ချင်တာရှိရင် ရေးပါ" rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label></section>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 font-bold text-red-700">{error}</div>}{message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-700">{message}</div>}
        <div className="flex flex-col gap-2 sm:flex-row"><button disabled={submitting} className="w-full rounded-xl bg-orange-500 px-4 py-4 text-lg font-black text-white shadow-sm hover:bg-orange-600 disabled:opacity-60">{submitting ? "တင်နေပါသည်..." : editingSubmissionId ? `Update လုပ်ရန် (${filledEntries.length} မျိုး)` : `တင်သွင်းရန် (${filledEntries.length} မျိုး)`}</button>{editingSubmissionId ? <button type="button" onClick={cancelEdit} className="rounded-xl border border-slate-300 bg-white px-5 py-4 text-lg font-black text-slate-700">မပြင်တော့ပါ</button> : null}</div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div><h2 className="text-2xl font-black text-slate-800">ထွက်ရှိမှုမှတ်တမ်းများ</h2><p className="text-xs text-slate-500">Date Filter ဖြင့် မနေ့၊ ဒီနေ့နှင့် ရှေ့နေ့များ၏ record များကို ကြည့်နိုင်ပါသည်။</p></div>
          <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-2 lg:w-auto">
            <span className="text-sm font-black text-indigo-900">မှတ်တမ်း Date</span>
            <button type="button" onClick={() => setHistoryDate((value) => shiftDateValue(value, -1))} className="rounded-lg border-2 border-indigo-300 bg-white px-3 text-2xl font-black text-indigo-800">‹</button>
            <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className="h-12 min-w-0 flex-1 rounded-lg border-2 border-indigo-300 bg-white px-2 text-center text-base font-black text-indigo-950 sm:flex-none" />
            <button type="button" onClick={() => setHistoryDate((value) => shiftDateValue(value, 1))} className="rounded-lg border-2 border-indigo-300 bg-white px-3 text-2xl font-black text-indigo-800">›</button>
          </div>
        </div>
        <div className="mb-3 text-right text-xs text-slate-500">{loadingHistory ? "ရယူနေသည်..." : `${groupedHistory.length} ကြိမ်`}</div>
        {groupedHistory.length === 0 && !loadingHistory ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">{historyDate} အတွက် ထွက်ရှိမှုမှတ်တမ်း မရှိသေးပါ</p> : <div className="space-y-3">{groupedHistory.map((group) => <div key={group.submissionId || group.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-black text-slate-800">{group.machineCode} — {group.machineName}</div><div className="text-xs text-slate-500">{group.reportDate} · {group.actorName}</div></div><div className="flex gap-2"><button type="button" onClick={() => startEdit(group)} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-black text-amber-800">ပြင်</button><button type="button" onClick={() => deleteReport(group)} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-black text-red-700">ဖျက်</button></div></div><div className="mt-2 grid gap-1 text-sm">{group.rows.map((row) => <div key={row.id} className="rounded-lg bg-white px-2 py-1 font-semibold">{row.category === "tube" ? `${row.tubeG} ${row.tubeColor}` : row.bottleType} · {row.outputQuantity} {row.outputUnit} × {row.outputCapacity} = {formatNumber(Number(row.outputQuantity) * Number(row.outputCapacity))} ဗူး</div>)}</div><div className="mt-2 text-sm font-black text-emerald-700">စုစုပေါင်း {formatNumber(group.totalPieces)} ဗူး · ပျက်စီး {formatNumber(group.wasteQuantity)} ဗူး · ကောင်းမွန် {formatNumber(Math.max(0, group.totalPieces - Number(group.wasteQuantity || 0)))} ဗူး</div></div>)}</div>}
      </section>
    </main>
  );
}
