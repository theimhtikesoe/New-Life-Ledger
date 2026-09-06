'use client';

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

function displayMachineName(machineCode, machineName) {
  const machine = MACHINES.find((item) => item.code === machineCode);
  return machine?.category === "bottle" ? machine.name : (machineName || machineCode);
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
  const [tubeDamageQuantity, setTubeDamageQuantity] = useState("0");
  const [tubeQuantity, setTubeQuantity] = useState("0");
  const [tubeQuantityUnit, setTubeQuantityUnit] = useState("အိတ်");
  const [involvedWorkers, setInvolvedWorkers] = useState([]);
  const [workerNameDraft, setWorkerNameDraft] = useState("");
  const [savedWorkers, setSavedWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [history, setHistory] = useState([]);
  const [editingSubmissionId, setEditingSubmissionId] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState("");
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
      const key = category === "tube"
        ? `${entry.tubeG} ${entry.tubeColor} · ${entry.capacity.toLocaleString()} ဗူး/အိတ်`
        : `${entry.bottleType} · ${entry.capacity.toLocaleString()} ဆံ့`;
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
    const normalized = value === "" ? "" : String(value).replace(/^0+(?=\d)/, "");
    setLines((current) => ({ ...current, [key]: normalized }));
  }

  function clearZeroOnFocus(key) {
    setLines((current) => current[key] === "0" ? { ...current, [key]: "" } : current);
  }

  function focusField(field) {
    setFocusedField(field);
  }

  function blurField() {
    setFocusedField("");
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
      const actorName = localStorage.getItem("actorName") || "Rhyzoe";
      const response = await fetch("/api/production-workers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-actor-name": encodeURIComponent(actorName) },
        body: JSON.stringify({ name }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Worker ထည့်၍မရပါ။");
      const savedWorker = body.data;
      setWorkerNameDraft("");
      setInvolvedWorkers((current) => current.includes(savedWorker.name) ? current : [...current, savedWorker.name]);
      setSavedWorkers((current) => [...current.filter((worker) => worker.id !== savedWorker.id && worker.name !== savedWorker.name), savedWorker].sort((left, right) => left.name.localeCompare(right.name)));
    } catch (addError) {
      setError(addError.message);
    }
  }

  function handleWorkerDraftKeyDown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addSavedWorker(event);
  }

  function startWorkerLongPress(name, id) {
    suppressWorkerClickRef.current = false;
    workerPressTimerRef.current = window.setTimeout(async () => {
      suppressWorkerClickRef.current = true;
      if (!window.confirm(`${name}\\n\\nShared Worker စာရင်းမှ ဖယ်ရှားမလား?`)) return;
      try {
        const actorName = localStorage.getItem("actorName") || "Rhyzoe";
        const response = await fetch(`/api/production-workers?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { "x-actor-name": encodeURIComponent(actorName) },
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Worker ဖယ်၍မရပါ။");
        setInvolvedWorkers((current) => current.filter((item) => item !== name));
        setSavedWorkers((current) => current.filter((item) => item.id !== id && item.name !== name));
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
    setTubeDamageQuantity("0");
    setTubeQuantity("0");
    setTubeQuantityUnit("အိတ်");
    setInvolvedWorkers([]);
    setWorkerNameDraft("");
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
    setTubeDamageQuantity(String(group.tubeDamageQuantity || 0));
    setTubeQuantity(String(group.tubeQuantityValue ?? group.tubeQuantity ?? 0));
    setTubeQuantityUnit(group.tubeQuantityUnit === "ခြင်း" ? "ခြင်း" : "အိတ်");
    const workerNames = Array.isArray(first.involvedWorkers) ? first.involvedWorkers : [];
    setInvolvedWorkers(workerNames);
    setWorkerNameDraft("");
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
      const response = await fetch(`/api/production-reports?submissionId=${encodeURIComponent(submissionId)}`, { method: "DELETE", headers: { "x-actor-name": encodeURIComponent(localStorage.getItem("actorName") || "Rhyzoe") } });
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
    const workerNames = involvedWorkers;
    const typeLines = summaryByType.map((item) => `${item.label}: ${formatNumber(item.cards)} ကဒ် / ${formatNumber(item.pieces)} ဗူး`).join("\n");
    const summary = `နေ့စွဲ: ${reportDate}\nဗူးအမျိုးအစား: ${category === "tube" ? "Tube" : "ဗူးခွံ"}\nပူးတွဲဆင်းသူ: ${workerNames.join(", ") || "မဖြည့်ရသေး"}\n\n${typeLines}\n\nဗူးပျက်: ${formatNumber(damagedPieces)}\nTube ပျက်: ${formatNumber(Number(tubeDamageQuantity || 0))}\nTube အရေအတွက်: ${formatNumber(Number(tubeQuantity || 0))} ${tubeQuantityUnit}`;
    if (!window.confirm(`သိမ်းမည့် Production Report အကျဉ်းချုပ်\n\n${summary}\n\nဆက်လက်တင်သွင်းမလား?`)) return;
    setSubmitting(true);
    try {
      const actorName = localStorage.getItem("actorName") || "Rhyzoe";
      const response = await fetch("/api/production-reports", {
        method: editingSubmissionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "x-actor-name": encodeURIComponent(actorName) },
        body: JSON.stringify({ reportDate, ...(editingSubmissionId ? { submissionId: editingSubmissionId } : {}), machineCode, category, rows: filledEntries, wasteQuantity, tubeDamageQuantity, tubeQuantityValue: tubeQuantity, tubeQuantity, tubeQuantityUnit, involvedWorkers: workerNames }),
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
    <main className="app-page-main production-page">
      <div className="app-page-container app-page-surface production-container">
        <form onSubmit={submit} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-800">အခြေခံ အချက်အလက်</h2>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-2 rounded-2xl border-2 border-orange-200 bg-orange-50 p-4 text-base font-black text-orange-950 shadow-sm"><RequiredLabel>စက်</RequiredLabel><select value={machineCode} onChange={(event) => setMachineCode(event.target.value)} className="h-14 w-full rounded-xl border-2 border-orange-300 bg-white px-3 text-lg font-black"><option value="">စက်ရွေးချယ်ရန်</option>{MACHINES.filter((machine) => !machine.category || machine.category === category).map((machine) => <option key={machine.code} value={machine.code}>{machine.name}</option>)}</select></label>
            <label className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-4 text-base font-black text-cyan-950 shadow-sm"><RequiredLabel>Date</RequiredLabel><span className="flex min-w-0 gap-1"><button type="button" onClick={() => setReportDate((value) => shiftDateValue(value, -1))} className="rounded-lg border-2 border-cyan-300 bg-white px-3 text-2xl font-black">‹</button><input type="date" max={today} value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="box-border h-14 min-w-0 flex-1 rounded-xl border-2 border-cyan-300 bg-white px-2 text-center text-lg font-black" /><button type="button" disabled={reportDate >= today} onClick={() => setReportDate((value) => shiftDateValue(value, 1))} className="rounded-lg border-2 border-cyan-300 bg-white px-3 text-2xl font-black disabled:opacity-40">›</button></span></label>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2"><h2 className="mb-1 text-lg font-black text-slate-800">ပူးတွဲဆင်းသူများ</h2><span className="text-sm font-black text-blue-700">{involvedWorkers.length} ယောက်ရွေးထား</span></div>
          <p className="mb-3 text-xs font-normal text-slate-500">ဆင်းတဲ့သူတွေကို နှိပ်ရွေးပါ။ Worker ခလုတ်ကို ကြာကြာဖိထားရင် shared list မှ ဖျက်နိုင်ပါတယ်။</p>
          <div className="flex flex-wrap gap-2">
            {loadingWorkers ? <span className="text-sm text-slate-500">Worker စာရင်း ရယူနေသည်...</span> : null}
            {!loadingWorkers && savedWorkers.length === 0 ? <span className="text-sm text-slate-500">Worker မရှိသေးပါ။ အောက်ကနေ အရင်ထည့်ပါ။</span> : null}
            {savedWorkers.map((worker) => {
              const selected = involvedWorkers.includes(worker.name);
              return <button key={worker.id || worker.name} type="button" onClick={() => { if (suppressWorkerClickRef.current) { suppressWorkerClickRef.current = false; return; } toggleWorker(worker.name); }} onPointerDown={() => startWorkerLongPress(worker.name, worker.id)} onPointerUp={endWorkerLongPress} onPointerLeave={endWorkerLongPress} onPointerCancel={endWorkerLongPress} className={`rounded-xl border-2 px-3 py-2 text-sm font-black transition ${selected ? "border-blue-700 bg-blue-600 text-white shadow-md" : "border-blue-200 bg-blue-50 text-blue-900 hover:border-blue-400"}`}>{selected ? "✓ " : ""}{worker.name}</button>;
            })}
          </div>
          <div className="mt-3 flex gap-2" role="group" aria-label="Worker အသစ်ထည့်ရန်">
            <input value={workerNameDraft} onChange={(event) => setWorkerNameDraft(event.target.value)} onFocus={() => focusField("worker")} onBlur={blurField} onKeyDown={handleWorkerDraftKeyDown} placeholder="Worker အသစ်ထည့်ရန်" className={`min-w-0 flex-1 rounded-xl border border-slate-300 p-3 ${focusedField === "worker" ? "ring-4 ring-amber-300 shadow-lg" : ""}`} />
            <button type="button" onClick={addSavedWorker} disabled={!workerNameDraft.trim() || loadingWorkers} className="rounded-xl bg-blue-600 px-4 py-3 font-black text-white disabled:opacity-50">ထည့် +</button>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
          <label className="mb-4 flex flex-col gap-2 rounded-2xl border-2 border-violet-200 bg-violet-50 p-4 text-base font-black text-violet-950"><span className="text-lg">အမျိုးအစား</span><select value={category} onChange={(event) => handleCategoryChange(event.target.value)} className="h-14 w-full rounded-xl border-2 border-violet-300 bg-white px-3 text-lg font-black"><option value="bottle">ဗူးခွံ</option><option value="tube">Tube</option></select></label>
          <h2 className="mb-2 text-2xl font-black text-slate-800">ဗူးအမျိုးအစားနှင့် ဗူးကဒ် <span className="text-red-600">*</span></h2>
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900"><span className="font-black">မဖြည့်မနေရ —</span> စက်ရွေးပြီး size card အနည်းဆုံးတစ်မျိုးမှာ အရေအတွက်ထည့်ပါ။ `ဆံ့` ပမာဏက card ထဲမှာ သတ်မှတ်ပြီးသားဖြစ်ပါတယ်။</p>
          {category === "bottle" ? <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{BOTTLE_GROUPS.map((group) => <button type="button" key={group.key} onClick={() => setActiveBottleGroup(group.key)} className={`min-w-0 rounded-xl border p-3 text-left transition ${activeBottleGroup === group.key ? "border-teal-700 bg-teal-700 text-white shadow-md" : "border-teal-100 bg-teal-50 text-teal-900 hover:border-teal-300"}`}><span className="block truncate text-sm font-black">{group.label}</span><span className={`mt-1 block text-[11px] ${activeBottleGroup === group.key ? "text-teal-100" : "text-teal-700"}`}>{groupCounts[group.key] || 0} မျိုး</span></button>)}</div> : <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm font-bold text-cyan-800">Tube စက်အလိုက် ထုတ်လုပ်နိုင်သောအမျိုးအစားများ</div>}
          {category === "bottle" ? <p className="mb-3 text-xs font-semibold text-slate-500">{BOTTLE_GROUPS.find((group) => group.key === activeBottleGroup)?.description} — သက်ဆိုင်ရာ size များကိုသာ ပြထားပါသည်။</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleEntries.map((entry) => { const isBlue = entryIsBlue(entry); return <label key={entry.key} className={`rounded-2xl border-2 p-4 text-base font-bold shadow-sm ${isBlue ? "border-sky-200 bg-sky-50 text-sky-950" : "border-slate-300 bg-white text-slate-900"}`}><span className="flex items-center justify-between gap-2"><span className="min-w-0 text-lg font-black leading-tight">{entry.label}</span><span className={`shrink-0 rounded-full px-3 py-1 text-base font-black ${isBlue ? "border border-sky-300 bg-sky-100 text-sky-800" : "border border-slate-400 bg-slate-50 text-slate-700"}`}>{entry.capacity.toLocaleString()} {category === "tube" ? "ဗူး/အိတ်" : "ဆံ့"}</span></span><span className="mt-2 flex items-center gap-2 text-sm font-bold"><span className={`rounded-full border px-2 py-0.5 ${isBlue ? "border-sky-300 bg-sky-100 text-sky-800" : "border-slate-400 bg-slate-100 text-slate-700"}`}>{isBlue ? "ပြာ" : "ဖြူ"}</span><span>{category === "tube" ? entry.sub : `ကဒ်အရေအတွက် — ${entry.capacity.toLocaleString()} ဆံ့`}</span></span><input type="number" min="0" step="1" value={lines[entry.key] || ""} onFocus={() => { clearZeroOnFocus(entry.key); focusField(`line:${entry.key}`); }} onBlur={blurField} onChange={(event) => updateLine(entry.key, event.target.value)} placeholder="0" className={`mt-2 w-full rounded-xl border-2 bg-white p-4 text-right text-2xl font-black outline-none ${isBlue ? "border-sky-300 focus:border-sky-500" : "border-slate-300 focus:border-slate-600"} ${focusedField === `line:${entry.key}` ? "ring-4 ring-amber-300 shadow-lg" : ""}`} /></label>; })}</div>
        <section className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-black text-slate-800">ဗူးပျက်၊ Tube ပျက်နှင့် Tube အရေအတွက်</h2>
          <div className="grid items-stretch gap-3 sm:grid-cols-3">
            <label className="flex h-full flex-col text-sm font-bold text-slate-700"><span>ဗူးပျက်</span><input type="number" min="0" step="1" value={wasteQuantity} onFocus={() => { focusField("waste"); if (wasteQuantity === "0") setWasteQuantity(""); }} onBlur={blurField} onChange={(event) => setWasteQuantity(event.target.value === "" ? "" : String(Number(event.target.value)))} className={`mt-auto w-full rounded-xl border border-slate-300 p-3 font-bold ${focusedField === "waste" ? "ring-4 ring-amber-300 shadow-lg" : ""}`} /></label>
            <label className="flex h-full flex-col text-sm font-bold text-slate-700"><span>Tube ပျက် <span className="font-normal text-slate-500">(ဗူးမဖြစ်ဘဲ ပျက်)</span></span><p className="mt-1 text-xs font-normal text-slate-500">ဗူးမဖြစ်ဘဲ ပျက်သွားသော Tube</p><input type="number" min="0" step="1" value={tubeDamageQuantity} onFocus={() => { focusField("tubeDamage"); if (tubeDamageQuantity === "0") setTubeDamageQuantity(""); }} onBlur={blurField} onChange={(event) => setTubeDamageQuantity(event.target.value === "" ? "" : String(Number(event.target.value)))} className={`mt-auto w-full rounded-xl border border-slate-300 p-3 font-bold ${focusedField === "tubeDamage" ? "ring-4 ring-amber-300 shadow-lg" : ""}`} /></label>
            <label className="flex h-full flex-col text-sm font-bold text-slate-700"><span>Tube အရေအတွက် <span className="font-normal text-slate-500">(ဗူးထွက်ရန်သုံး)</span></span><p className="mt-1 text-xs font-normal text-slate-500">ဗူးထွက်လာဖို့ အသုံးပြုသော Tube</p><span className="mt-auto flex gap-2 pt-1"><input type="text" inputMode="decimal" value={tubeQuantity} onFocus={() => { focusField("tubeQuantity"); if (tubeQuantity === "0") setTubeQuantity(""); }} onBlur={blurField} onChange={(event) => setTubeQuantity(event.target.value)} className={`min-w-0 flex-1 rounded-xl border border-slate-300 p-3 font-bold ${focusedField === "tubeQuantity" ? "ring-4 ring-amber-300 shadow-lg" : ""}`} /><select value={tubeQuantityUnit} onFocus={() => focusField("tubeUnit")} onBlur={blurField} onChange={(event) => setTubeQuantityUnit(event.target.value)} className={`rounded-xl border border-slate-300 bg-white px-3 font-bold ${focusedField === "tubeUnit" ? "ring-4 ring-amber-300 shadow-lg" : ""}`}><option value="အိတ်">အိတ်</option><option value="ခြင်း">ခြင်း</option></select></span></label>
          </div>
        </section>
          <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 text-center"><div className="text-xs font-bold text-emerald-700">စုစုပေါင်းထွက်ရှိ</div><div className="text-2xl font-black text-emerald-800">{formatNumber(totalPieces)} <span className="text-sm">ဗူး</span></div><div className="text-xs text-emerald-700">{formatNumber(totalCards)} ဗူးကဒ်</div></div><div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-center"><div className="text-xs font-bold text-red-700">ဗူးပျက်</div><div className="text-2xl font-black text-red-800">{formatNumber(damagedPieces)} <span className="text-sm">ဗူး</span></div></div><div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-center"><div className="text-xs font-bold text-blue-700">ကောင်းမွန်ထွက်ရှိ</div><div className="text-2xl font-black text-blue-800">{formatNumber(goodPieces)} <span className="text-sm">ဗူး</span></div></div></div>
          {summaryByType.length ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><h3 className="mb-2 font-black text-slate-800">အမျိုးအစားအလိုက် စုစုပေါင်း</h3><div className="grid gap-2 sm:grid-cols-2">{summaryByType.map((item) => <div key={item.label} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm"><span className="font-bold text-slate-700">{item.label}</span><span className="text-right font-black text-slate-900">{formatNumber(item.cards)} ကဒ် · {formatNumber(item.pieces)} ဗူး</span></div>)}</div></div> : null}
        </section>

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
        {groupedHistory.length === 0 && !loadingHistory ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">{historyDate} အတွက် ထွက်ရှိမှုမှတ်တမ်း မရှိသေးပါ</p> : <div className="space-y-3">{groupedHistory.map((group) => <div key={group.submissionId || group.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-black text-slate-800">{displayMachineName(group.machineCode, group.machineName)}</div><div className="text-xs text-slate-500">{group.reportDate} · {group.actorName}</div></div><div className="flex gap-2"><button type="button" onClick={() => startEdit(group)} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-black text-amber-800">ပြင်</button><button type="button" onClick={() => deleteReport(group)} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-black text-red-700">ဖျက်</button></div></div><div className="mt-2 grid gap-1 text-sm">{group.rows.map((row) => <div key={row.id} className="rounded-lg bg-white px-2 py-1 font-semibold">{row.category === "tube" ? `${row.tubeG} ${row.tubeColor}` : `${row.bottleType} · ${row.outputCapacity} ဆံ့`} · {row.outputQuantity} {row.outputUnit} × {row.outputCapacity} = {formatNumber(Number(row.outputQuantity) * Number(row.outputCapacity))} ဗူး</div>)}</div><div className="mt-2 text-sm font-black text-emerald-700">စုစုပေါင်း {formatNumber(group.totalPieces)} ဗူး · ဗူးပျက် {formatNumber(group.wasteQuantity)} · Tube ပျက် (ဗူးမဖြစ်) {formatNumber(group.tubeDamageQuantity)} · Tube အရေအတွက် (ဗူးထွက်ရန်သုံး) {String(group.tubeQuantityValue ?? group.tubeQuantity ?? 0)} {group.tubeQuantityUnit || "အိတ်"} · ကောင်းမွန် {formatNumber(Math.max(0, group.totalPieces - Number(group.wasteQuantity || 0)))} ဗူး</div></div>)}</div>}
      </section>
        </div>
    </main>
  );
}
