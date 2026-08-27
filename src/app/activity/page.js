"use client";

import { useEffect, useState } from "react";
import { formatMyanmarDateTime } from "@/lib/myanmar-time-client";
import { encodeActorHeader } from "@/lib/actor-header";
import { cashSaleTypeLabel } from "@/lib/cash-sale-utils";

const ACTORS = ["ဖေဖေ", "ပုံ့ပုံ့", "ဆောင်းဦး", "Staff"];
const ACTIONS = ["PAYMENT", "DEBT_INCREASE", "CASH_SALE", "CREATE", "UPDATE", "RESTORE", "DELETE", "PERMANENT_DELETE"];

function formatMyanmarDateInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

const today = formatMyanmarDateInputValue(new Date());
const ACTIVITY_SNAPSHOT_KEY = "new-life-ledger:activity-snapshot:v1";

function getActivitySnapshotKey(date, actor, action) {
  return `${ACTIVITY_SNAPSHOT_KEY}:${date}:${actor || "all"}:${action || "all"}`;
}

function readActivitySnapshot(date, actor, action) {
  if (typeof window === "undefined") return { found: false, logs: [] };
  try {
    const key = getActivitySnapshotKey(date, actor, action);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return { found: false, logs: [] };
    const snapshot = JSON.parse(raw);
    return { found: true, logs: Array.isArray(snapshot?.logs) ? snapshot.logs : [] };
  } catch {
    return { found: false, logs: [] };
  }
}

function saveActivitySnapshot(date, actor, action, logs) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getActivitySnapshotKey(date, actor, action), JSON.stringify({ savedAt: Date.now(), logs }));
  } catch (error) {
    console.warn("Activity snapshot could not be saved:", error);
  }
}

function isTransientActivityError(error) {
  const message = String(error?.message || "").trim();
  return error?.name === "AbortError" || error?.name === "TypeError" || /^(Failed to fetch|NetworkError|Load failed|Request timed out)$/i.test(message);
}

async function fetchLogs(query) {
  const actorName = localStorage.getItem("actorName") || "";
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`/api/audit-logs?${query}`, {
        cache: "no-store",
        signal: controller.signal,
        headers: { "x-actor-name": encodeActorHeader(actorName) },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Activity request မအောင်မြင်ပါ (${response.status})။`);
      return Array.isArray(body.data) ? body.data : [];
    } catch (error) {
      lastError = error;
      if (attempt < 2 && isTransientActivityError(error)) {
        await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
        continue;
      }
      if (error?.name === "AbortError") throw new Error("Activity data ရယူရန် အချိန်ကျော်ပါပြီ။ ခဏနေရင် ပြန်စမ်းပါ။");
      if (isTransientActivityError(error)) throw new Error("Activity data ရယူရာတွင် ခဏအဆင်မပြေပါ။ ပြန်စမ်းပါ။");
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw lastError || new Error("Activity data ရယူရာတွင် အဆင်မပြေပါ။");
}

function actionLabel(action) {
  return ({ PAYMENT: "ငွေချေ", DEBT_INCREASE: "အကြွေးတိုး", CASH_SALE: "လက်ငင်းရောင်း", CREATE: "အသစ်ထည့်", UPDATE: "ပြင်ဆင်", RESTORE: "ပြန်ယူ", DELETE: "ဖျက်", PERMANENT_DELETE: "အပြီးဖျက်" })[action] || action;
}

function money(value) {
  return value === null || value === undefined ? "" : `${Number(value).toLocaleString()} Ks`;
}

function normalizeMatchText(value) {
  return String(value || "").normalize("NFC").replace(/[၊,။:;()\[\]{}]/g, " ").replace(/\s+/g, "").toLocaleLowerCase("my-MM");
}

function logMatchesReviewTarget(log, target) {
  if (!target) return false;
  const metadata = log.metadata || {};
  const searchable = normalizeMatchText([log.entityLabel, log.summary, metadata.note, metadata.saleType, metadata.itemSize].filter(Boolean).join(" "));
  const customer = normalizeMatchText(target.customerName);
  const amount = target.amount ? Number(String(target.amount).replace(/,/g, "")) : null;
  const hasCustomer = Boolean(customer);
  const hasAmount = Number.isFinite(amount) && amount > 0;
  const hasAction = Boolean(target.action);
  const customerMatches = !hasCustomer || searchable.includes(customer);
  const amountMatches = !hasAmount || Number(metadata.amount) === amount;
  const actionMatches = !hasAction || String(log.action || "") === target.action;
  if (hasCustomer || hasAmount || hasAction) return customerMatches && amountMatches && actionMatches;
  const targetText = normalizeMatchText(target.targetText);
  return Boolean(targetText && searchable && targetText.split(/(?=Customer|ငွေ|အကြွေး)/u).some((part) => part.length > 3 && searchable.includes(part)));
}

export default function ActivityPage() {
  const [returnToAi] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("from") === "ai" && /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "");
  });
  const [reviewTarget] = useState(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const target = { customerName: params.get("customer") || "", amount: params.get("amount") || "", action: params.get("action") || "", targetText: params.get("targetText") || "" };
    return target.customerName || target.amount || target.action || target.targetText ? target : null;
  });
  const [date, setDate] = useState(() => {
    if (typeof window !== "undefined") {
      const requestedDate = new URLSearchParams(window.location.search).get("date") || "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return requestedDate;
    }
    return today;
  });
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [highlightedId, setHighlightedId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    let active = true;
    const cached = readActivitySnapshot(date, actor, action);
    if (cached.found) {
      setLogs(cached.logs);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError("");
    const params = new URLSearchParams({ date, limit: "500" });
    if (actor) params.set("actor", actor);
    if (action) params.set("action", action);
    fetchLogs(params.toString())
      .then((items) => {
        if (!active) return;
        setLogs(items);
        setError("");
        setLoading(false);
        saveActivitySnapshot(date, actor, action, items);
      })
      .catch((err) => {
        if (!active) return;
        if (!cached.found) setError(err.message || "Activity data ရယူရာတွင် အဆင်မပြေပါ။");
        setLoading(false);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [date, actor, action]);

  async function handleDeleteLog(log) {
    if (!log || log.eventSource === "legacy" || deletingId) return;
    const label = log.entityLabel || log.summary || "ဒီမှတ်တမ်း";
    if (!window.confirm(`${label}\n\nဒီ Activity မှတ်တမ်းကို ဖျောက်မလား?\nမူရင်း Customer/Ledger/လက်ငင်းရောင်းစာရင်း မဖျက်ပါ။`)) return;
    setDeletingId(String(log.id));
    setError("");
    try {
      const actorName = localStorage.getItem("actorName") || "";
      const response = await fetch(`/api/audit-logs/${encodeURIComponent(log.id)}`, {
        method: "DELETE",
        headers: { "x-actor-name": encodeActorHeader(actorName) },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Activity မှတ်တမ်းကို ဖယ်၍ မရပါ။");
      setLogs((current) => {
        const nextLogs = current.filter((item) => String(item.id) !== String(log.id));
        saveActivitySnapshot(date, actor, action, nextLogs);
        return nextLogs;
      });
      setHighlightedId((current) => (current === String(log.id) ? "" : current));
    } catch (err) {
      setError(err.message || "Activity မှတ်တမ်းကို ဖယ်၍ မရပါ။");
    } finally {
      setDeletingId("");
    }
  }

  useEffect(() => {
    if (!reviewTarget || !logs.length) return undefined;
    const match = logs.find((log) => logMatchesReviewTarget(log, reviewTarget));
    setHighlightedId(match?.id ? String(match.id) : "");
    if (!match?.id) return undefined;
    const timer = window.setTimeout(() => { const targetId = String(match.id); const target = Array.from(document.querySelectorAll("[data-activity-id]")).find((element) => element.getAttribute("data-activity-id") === targetId && element.getClientRects().length > 0); target?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 80);
    return () => window.clearTimeout(timer);
  }, [logs, reviewTarget]);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <a href="/" className="text-sm font-medium text-cyan-700">← Dashboard</a>
            {returnToAi ? <a href={`/daily-summary?date=${encodeURIComponent(date)}#ai-explanation`} className="text-sm font-semibold text-violet-700">← AI ရှင်းပြချက်သို့ ပြန်သွားရန်</a> : null}
          </div>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><h1 className="text-2xl font-bold text-slate-900">Activity History</h1><p className="mt-1 text-sm text-slate-600">အရင်စာရင်းများနှင့် လက်ရှိလုပ်ဆောင်ချက်များကို အသေးစိတ်ကြည့်ရန်</p></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800" /><select value={actor} onChange={(e) => setActor(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"><option value="">User အားလုံး</option>{ACTORS.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"><option value="">Action အားလုံး</option>{ACTIONS.map((item) => <option key={item} value={item}>{actionLabel(item)}</option>)}</select></div>
          </div>
        </header>

        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>}
        {reviewTarget ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>AI ပြန်စစ်ရန် ရွေးထားသည့် record:</strong> {reviewTarget.customerName || "Customer မသတ်မှတ်ရသေး"}{reviewTarget.amount ? ` · ${Number(reviewTarget.amount).toLocaleString()} Ks` : ""} {highlightedId ? " — အောက်မှာ မီးမောင်းထိုးပြထားပါသည်။" : logs.length && !loading ? " — ကိုက်ညီသော record မတွေ့သေးပါ။" : " — ရှာနေပါသည်။"}</div> : null}
        <section id="activity-results" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">{date} Activity</h2><p className="mt-1 text-xs text-slate-500">အရင်စာရင်းများတွင် လုပ်သူအမည်ကို မသိပါက အလွတ်ထားထားပါသည်။</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{logs.length} actions</span></div>
          {loading ? <p className="py-10 text-center text-slate-500">မှတ်တမ်းများ ရယူနေသည်...</p> : <>
            <div className="space-y-3 md:hidden">{logs.length ? logs.map((log) => { const metadata = log.metadata || {}; const isLegacy = log.eventSource === "legacy"; const isHighlighted = highlightedId === String(log.id); return <article id={`activity-mobile-${log.id}`} data-activity-id={String(log.id)} key={`mobile-${log.id}`} className={`rounded-xl border bg-white p-4 shadow-sm transition ${isHighlighted ? "border-amber-500 ring-2 ring-amber-300 shadow-amber-100" : "border-slate-200"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">{formatMyanmarDateTime(log.createdAt)}</p><p className="mt-1 font-medium text-slate-800">{log.actorName || ""}</p></div><span className={`rounded-full px-2 py-1 text-xs font-medium ${log.action === "PAYMENT" ? "bg-emerald-100 text-emerald-700" : log.action === "DEBT_INCREASE" ? "bg-rose-100 text-rose-700" : log.action === "CASH_SALE" ? "bg-cyan-100 text-cyan-700" : log.action.includes("DELETE") ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{actionLabel(log.action)}</span></div><div className="mt-3 border-t border-slate-100 pt-3"><p className="font-medium text-slate-800">{log.entityLabel || ""}</p><p className="mt-1 text-sm text-slate-600">{log.summary}</p></div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs"><div><p className="text-slate-500">ပမာဏ</p><p className="mt-1 font-medium text-slate-800">{money(metadata.amount) || "-"}</p></div><div><p className="text-slate-500">Payment</p><p className="mt-1 font-medium text-slate-800">{log.action === "CASH_SALE" && metadata.saleType ? `${metadata.paymentType || "CASH"} · ${cashSaleTypeLabel(metadata.saleType)}` : metadata.paymentType || "-"}</p></div></div><div className="mt-3 flex items-center justify-between gap-2 text-xs"><span className="text-slate-600">{metadata.note || ""}</span><span className={`rounded-full px-2 py-1 ${isLegacy ? "bg-slate-100 text-slate-600" : "bg-cyan-100 text-cyan-700"}`}>{isLegacy ? "အရင်စာရင်း" : "အသစ်မှတ်တမ်း"}</span></div>{!isLegacy ? <button type="button" onClick={() => handleDeleteLog(log)} disabled={deletingId === String(log.id)} className="mt-3 min-h-9 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-60">{deletingId === String(log.id) ? "ဖယ်နေသည်..." : "ဒီလိုင်းကို ဖျက်ရန်"}</button> : null}</article>; }) : <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">ဒီနေ့လုပ်ဆောင်ချက်မရှိသေးပါ။</div>}</div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">စာရင်းနေ့/အချိန်</th><th className="px-3 py-3">လုပ်သူ</th><th className="px-3 py-3">လုပ်ဆောင်ချက်</th><th className="px-3 py-3">Customer / အကြောင်းအရာ</th><th className="px-3 py-3 text-right">ပမာဏ</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Note</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">လုပ်ဆောင်ချက်</th></tr></thead><tbody className="divide-y divide-slate-100">{logs.length ? logs.map((log) => { const metadata = log.metadata || {}; const isLegacy = log.eventSource === "legacy"; const isHighlighted = highlightedId === String(log.id); return <tr id={`activity-desktop-${log.id}`} data-activity-id={String(log.id)} key={log.id} className={`align-top transition hover:bg-slate-50 ${isHighlighted ? "bg-amber-50 ring-2 ring-inset ring-amber-300" : ""}`}><td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{formatMyanmarDateTime(log.createdAt)}</td><td className="px-3 py-3 font-medium text-slate-800">{log.actorName || ""}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${log.action === "PAYMENT" ? "bg-emerald-100 text-emerald-700" : log.action === "DEBT_INCREASE" ? "bg-rose-100 text-rose-700" : log.action === "CASH_SALE" ? "bg-cyan-100 text-cyan-700" : log.action.includes("DELETE") ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{actionLabel(log.action)}</span></td><td className="max-w-[260px] px-3 py-3 text-slate-800"><div className="font-medium">{log.entityLabel || ""}</div><div className="mt-1 text-xs text-slate-500">{log.summary}</div></td><td className="whitespace-nowrap px-3 py-3 text-right font-medium text-slate-800">{money(metadata.amount)}</td><td className="px-3 py-3 text-slate-600">{log.action === "CASH_SALE" && metadata.saleType ? `${metadata.paymentType || "CASH"} · ${cashSaleTypeLabel(metadata.saleType)}` : metadata.paymentType || ""}</td><td className="max-w-[220px] px-3 py-3 text-slate-600">{metadata.note || ""}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs ${isLegacy ? "bg-slate-100 text-slate-600" : "bg-cyan-100 text-cyan-700"}`}>{isLegacy ? "အရင်စာရင်း" : "အသစ်မှတ်တမ်း"}</span></td><td className="px-3 py-3">{!isLegacy ? <button type="button" onClick={() => handleDeleteLog(log)} disabled={deletingId === String(log.id)} className="min-h-9 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-60">{deletingId === String(log.id) ? "ဖယ်နေသည်..." : "ဒီလိုင်းကို ဖျက်ရန်"}</button> : <span className="text-xs text-slate-400">မရပါ</span>}</td></tr>; }) : <tr><td colSpan="9" className="px-3 py-10 text-center text-slate-500">ဒီနေ့လုပ်ဆောင်ချက်မရှိသေးပါ။</td></tr>}</tbody></table></div></>}
        </section>
      </div>
    </main>
  );
}
