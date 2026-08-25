
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeActorHeader } from "@/lib/actor-header";
import { formatMyanmarDateTime } from "@/lib/myanmar-time-client";

const STATUS_LABELS = {
  DRAFT: "Draft ပြန်စစ်ရန်",
  NEEDS_CUSTOMER: "Customer မတွေ့သေး",
  NEEDS_REVIEW: "အချက်အလက် မပြည့်စုံ",
  CONFIRMED: "အတည်ပြုပြီး",
  BATCH_QUEUED: "မနက် batch စောင့်နေ",
  FACTORY_NOTIFIED: "စက်ရုံသို့ ပို့ပြီး",
  PREPARED: "ပြင်ဆင်ပြီး",
  COMPLETED: "ပြီးစီးပြီး",
  CANCELLED: "ပယ်ဖျက်ပြီး",
};

const STATUS_STYLES = {
  NEEDS_CUSTOMER: "border-amber-200 bg-amber-50 text-amber-800",
  NEEDS_REVIEW: "border-orange-200 bg-orange-50 text-orange-800",
  CONFIRMED: "border-blue-200 bg-blue-50 text-blue-800",
  BATCH_QUEUED: "border-violet-200 bg-violet-50 text-violet-800",
  FACTORY_NOTIFIED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  PREPARED: "border-teal-200 bg-teal-50 text-teal-800",
  COMPLETED: "border-green-200 bg-green-50 text-green-800",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-600",
  DRAFT: "border-slate-200 bg-slate-50 text-slate-700",
};

const ORDER_HISTORY_ACTION_LABELS = {
  ORDER_DRAFT: "Draft ဖန်တီး",
  ORDER_CUSTOMER_LINK: "Customer ချိတ်",
  ORDER_CUSTOMER_CREATE: "Customer အသစ်ဖန်တီး",
  ORDER_DETAILS_UPDATE: "အချက်အလက်ပြင်",
  ORDER_CONFIRM: "Confirm",
  ORDER_CANCEL: "Cancel",
  ORDER_ARCHIVE: "History သို့ရွှေ့",
  ORDER_RESTORE: "History မှ ပြန်ယူ",
  ORDER_TRASH_RESTORE: "အမှိုက်ပုံးမှ ပြန်ယူ",
  ORDER_AUTO_CLEAR: "သက်တမ်းကျော်၍ Auto Clear",
  ORDER_UPDATE: "Order ပြင်ဆင်",
  ORDER_AI_RETRY: "AI ဖြင့် ပြန်စစ်",
};

const ARCHIVABLE_STATUSES = ["FACTORY_NOTIFIED", "PREPARED", "COMPLETED"];
const TRASH_RETENTION_DAYS = 15;

function formatDate(value) {
  if (!value) return "မသတ်မှတ်ရသေး";
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
}

function retentionLabel(value) {
  if (!value) return "Cancel ရက် မသိရသေးပါ";
  const cancelledAt = new Date(value);
  if (Number.isNaN(cancelledAt.getTime())) return "Cancel ရက် မသိရသေးပါ";
  const elapsed = Math.floor((Date.now() - cancelledAt.getTime()) / (24 * 60 * 60 * 1000));
  const daysLeft = Math.max(TRASH_RETENTION_DAYS - elapsed, 0);
  return daysLeft ? `Restore လုပ်ရန် ${daysLeft} ရက်ကျန်` : "Restore သက်တမ်းကုန်နေပါပြီ";
}

function actorHeaders() {
  if (typeof window === "undefined") return {};
  return { "x-actor-name": encodeActorHeader(localStorage.getItem("actorName") || "Staff") };
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...actorHeaders(), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(body.error || "Order request မအောင်မြင်ပါ။");
  return body;
}

function OrderLines({ order }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ဘူးစာရင်း</p>
      {(order.lines || []).map((line, index) => (
        <div key={line.id || index} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{index + 1}. {line.bottleType || "ဘူး"} · {line.capacityLabel || `${line.capacityMl || "?"} ml`}</p>
          <p className="mt-1">{line.cardCount || "?"} ကဒ် × တစ်ကဒ် {line.bottlesPerCard || "?"} ဘူး = <strong>{line.totalBottles || "မတွက်နိုင်သေး"}</strong> ဘူး</p>
          {line.notes ? <p className="mt-1 text-xs text-slate-500">မှတ်ချက်: {line.notes}</p> : null}
        </div>
      ))}
      <p className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">စုစုပေါင်း — {order.totals?.totalCards || 0} ကဒ် / {order.totals?.totalBottles || 0} ဘူး</p>
    </div>
  );
}

function CapLines({ order }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">အဖုံးစာရင်း</p>
      {(order.caps || []).length ? order.caps.map((cap, index) => (
        <div key={cap.id || index} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{cap.capType}</p>
          <p className="mt-1">ပုံမှန် {(cap.normalPcs || 0).toLocaleString()} pcs + အပို {(cap.extraPcs || 0).toLocaleString()} pcs = <strong>{(cap.requestedTotalPcs || 0).toLocaleString()}</strong> pcs</p>
          {cap.warningText ? <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">⚠️ {cap.warningText} (သတိပေးချက်သာ)</p> : null}
        </div>
      )) : <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">အဖုံးအချက်အလက် မပါသေးပါ။</p>}
    </div>
  );
}

function OrderHistoryTimeline({ logs }) {
  if (!logs.length) return <p className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">Order လုပ်ဆောင်ချက်မှတ်တမ်း မရှိသေးပါ။</p>;
  return (
    <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
      <p className="font-semibold text-indigo-950">Order History မှတ်တမ်း</p>
      <div className="mt-2 space-y-2">
        {logs.slice(0, 12).map((log) => (
          <div key={log.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs">
            <div>
              <p className="font-semibold text-slate-800">{ORDER_HISTORY_ACTION_LABELS[log.action] || log.action}</p>
              <p className="mt-1 text-slate-600">{log.summary}</p>
            </div>
            <div className="text-right text-slate-500">
              <p>{formatMyanmarDateTime(log.createdAt)}</p>
              <p className="mt-1">{log.actorName || "Staff"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [trashCount, setTrashCount] = useState(0);
  const [orderLogs, setOrderLogs] = useState([]);
  const [viewMode, setViewMode] = useState("ACTIVE");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [automation, setAutomation] = useState({ morningBatchEnabled: true, morningBatchTime: "08:10" });
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [publishingGuide, setPublishingGuide] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [draftCustomers, setDraftCustomers] = useState({});
  const [candidateMap, setCandidateMap] = useState({});
  const [candidateLoadingId, setCandidateLoadingId] = useState("");
  const [detailEdits, setDetailEdits] = useState({});

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const orderQuery = viewMode === "TRASH"
        ? "/api/orders?view=trash&limit=200"
        : viewMode === "HISTORY"
          ? "/api/orders?view=history&limit=200"
          : "/api/orders?limit=200";
      const [ordersBody, settingBody, historyBody, trashBody] = await Promise.all([
        requestJson(orderQuery),
        viewMode === "ACTIVE" ? requestJson("/api/order-automation") : Promise.resolve(null),
        viewMode !== "ACTIVE" ? requestJson("/api/audit-logs?includeOrders=true&limit=500") : Promise.resolve(null),
        viewMode === "TRASH" ? Promise.resolve(null) : requestJson("/api/orders?view=trash&limit=200"),
      ]);
      const nextOrders = Array.isArray(ordersBody.data) ? ordersBody.data : [];
      setOrders(nextOrders);
      setTrashCount(viewMode === "TRASH" ? nextOrders.length : Array.isArray(trashBody?.data) ? trashBody.data.length : 0);
      setOrderLogs(viewMode !== "ACTIVE" && Array.isArray(historyBody?.data) ? historyBody.data.filter((log) => log.entityType === "Order") : []);
      if (settingBody?.data) setAutomation({ morningBatchEnabled: Boolean(settingBody.data.morningBatchEnabled), morningBatchTime: settingBody.data.morningBatchTime || "08:10" });
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [viewMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedOrderId(params.get("orderId") || "");
    const requestedStatus = params.get("status");
    const requestedView = params.get("view");
    if (requestedView === "trash" || requestedStatus === "CANCELLED") setViewMode("TRASH");
    else if (requestedView === "history") setViewMode("HISTORY");
    if (["NEEDS_CUSTOMER", "NEEDS_REVIEW", "DRAFT", "CONFIRMED", "BATCH_QUEUED", "FACTORY_NOTIFIED", "PREPARED", "COMPLETED", "CANCELLED"].includes(requestedStatus)) setStatusFilter(requestedStatus);
    load();
    const interval = window.setInterval(() => load({ silent: true }), 20000);
    return () => window.clearInterval(interval);
  }, [load]);

  const filteredOrders = useMemo(() => statusFilter === "ALL" ? orders : orders.filter((order) => order.status === statusFilter), [orders, statusFilter]);
  const customerOrderSummary = useMemo(() => {
    const pendingOrders = orders.filter((order) => ["DRAFT", "NEEDS_CUSTOMER", "NEEDS_REVIEW"].includes(order.status));
    return {
      pendingOrders,
      needsCustomerCount: pendingOrders.filter((order) => order.status === "NEEDS_CUSTOMER").length,
      needsReviewCount: pendingOrders.filter((order) => ["DRAFT", "NEEDS_REVIEW"].includes(order.status)).length,
    };
  }, [orders]);
  const orderLogsById = useMemo(() => {
    const map = new Map();
    orderLogs.forEach((log) => {
      const key = String(log.entityId || "");
      if (!key) return;
      map.set(key, [...(map.get(key) || []), log]);
    });
    return map;
  }, [orderLogs]);

  const patchOrder = async (orderId, action, payload = {}) => {
    setWorkingId(orderId);
    setError("");
    setMessage("");
    try {
      const body = await requestJson("/api/orders", { method: "PATCH", body: JSON.stringify({ orderId, action, ...payload }) });
      if (body.warning) setMessage(body.warning);
      else if (action === "archive") setMessage("Order ကို History ထဲ ရွှေ့ပြီးပါပြီ။ Data မဖျက်ထားပါ။");
      else if (action === "restore") setMessage("Order ကို History မှ ပြန်ယူပြီးပါပြီ။ မူရင်း status မပြောင်းပါ။");
      else if (action === "trash_restore") setMessage("Cancelled Order ကို Trash မှ ပြန်ယူပြီး Draft အဖြစ်ထားပါပြီ။");
      else if (action === "retry_ai") setMessage(body.warning || "AI ဖြင့် ပြန်စစ်ပြီးပါပြီ။ မူရင်း Order စာသားနှင့် Website/Telegram Draft ကို ထိန်းသိမ်းထားပါသည်။");
      else setMessage("Order ပြင်ဆင်မှု အောင်မြင်ပါပြီ။");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorkingId("");
    }
  };

  const archive = (order) => {
    if (window.confirm("ဒီ Order ကို History ထဲရွှေ့မလား။ Database ထဲက Order၊ Customer၊ Ledger data မဖျက်ပါ။")) patchOrder(order.id, "archive");
  };

  const setDraftField = (orderId, field, value) => {
    setDraftCustomers((current) => ({ ...current, [orderId]: { ...(current[orderId] || {}), [field]: value } }));
  };

  const setDetailField = (orderId, field, value) => {
    setDetailEdits((current) => ({ ...current, [orderId]: { ...(current[orderId] || {}), [field]: value } }));
  };

  const saveOrderDetails = async (order) => {
    const details = detailEdits[order.id] || {};
    await patchOrder(order.id, "update_details", {
      requestedDate: details.requestedDate ?? order.requestedDate ?? "",
      destination: details.destination ?? order.destination ?? "",
      customerPhone: details.customerPhone ?? order.customerPhone ?? "",
    });
  };

  const findCandidates = async (order) => {
    setCandidateLoadingId(order.id);
    setError("");
    try {
      const query = order.draftCustomerName || order.customerPhone || "";
      const body = await requestJson(`/api/customers?q=${encodeURIComponent(query)}&includeLedgers=false`);
      setCandidateMap((current) => ({ ...current, [order.id]: Array.isArray(body.data) ? body.data.slice(0, 8) : [] }));
    } catch (err) {
      setError(err.message);
    } finally {
      setCandidateLoadingId("");
    }
  };

  const publishTelegramGuide = async () => {
    if (!window.confirm("Telegram Order group ထဲမှာ Order ရေးနည်း guide message အသစ်တစ်စောင် ပို့ပြီး pin လုပ်မလား။")) return;
    setPublishingGuide(true);
    setError("");
    setMessage("");
    try {
      const body = await requestJson("/api/admin/telegram-order-guide", { method: "POST" });
      setMessage(body.pinned ? "Telegram Order guide ကို group ထဲ ပို့ပြီး pin လုပ်ထားပါပြီ။" : "Telegram Order guide ကို group ထဲ ပို့ထားပါပြီ။");
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishingGuide(false);
    }
  };

  const saveAutomation = async (enabled) => {
    setSavingAutomation(true);
    setError("");
    setMessage("");
    try {
      const body = await requestJson("/api/order-automation", { method: "PATCH", body: JSON.stringify({ morningBatchEnabled: enabled, morningBatchTime: "08:10" }) });
      setAutomation({ morningBatchEnabled: Boolean(body.data.morningBatchEnabled), morningBatchTime: body.data.morningBatchTime || "08:10" });
      setMessage(enabled ? "မနက် batch ကို Website မှ ဖွင့်ထားပါပြီ။ 08:10 Myanmar Time တွင်သာ ပို့ပါမယ်။" : "မနက် batch ကို ပိတ်ထားပါပြီ။ Queue ထဲက order များကို မပို့သေးပါ။");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAutomation(false);
    }
  };

  const counts = orders.reduce((result, order) => {
    result[order.status] = (result[order.status] || 0) + 1;
    return result;
  }, {});

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <a href="/" className="text-sm font-semibold text-cyan-700">← Dashboard</a>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Telegram Orders</h1>
              <p className="mt-1 text-sm text-slate-600">Order စာရင်းကို စစ်ဆေးရန်၊ Confirm/Cancel လုပ်ရန်နှင့် ဖျက်မည့်အစား History/အမှိုက်ပုံးထဲ ရွှေ့ရန်</p>
            </div>
          </div>
        </header>

        {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

        <section id="telegram-order-guide" className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wider text-cyan-700">Telegram Order Guide</p><h2 className="mt-1 text-lg font-bold text-slate-900">Group ထဲမှာ Order ရေးရန်</h2><p className="mt-1 text-sm text-slate-600">စာအစမှာ <code className="rounded bg-cyan-100 px-1.5 py-0.5 font-semibold text-cyan-900">မှာယူမှု</code> သို့မဟုတ် <code className="rounded bg-cyan-100 px-1.5 py-0.5 font-semibold text-cyan-900">/order</code> ထည့်ရေးပါ။</p></div>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">ပုံမှန်စကားများ မဖမ်းပါ</span><button type="button" onClick={publishTelegramGuide} disabled={publishingGuide} className="rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50">{publishingGuide ? "ပို့နေသည်..." : "📌 Group ထဲ Guide တင်ရန်"}</button></div>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-cyan-50">မှာယူမှု ကံလီ{`\n`}0.3 Liter အပြာ{`\n`}400 ဆံ့ 20 ကဒ်{`\n`}အဖုံးပြာ 5000 pcs + အပို 20{`\n`}ပုလဲဂိတ်{`\n`}မနက်ဖြန်</pre>
          <p className="mt-3 text-xs text-slate-500">AI စစ်ပြီး Draft ပြန်ပေးပါမယ်။ Confirm/Cancel ခလုတ်ကို group admin သာ သုံးနိုင်ပါမယ်။</p>
        </section>

        {viewMode === "ACTIVE" ? <section id="customer-orders" className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Customer Orders</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">Telegram မှာဝင်လာသော Customer Orders</h2>
              <p className="mt-1 text-sm text-slate-600">မတွေ့သေးသော Customer နှင့် ပြန်စစ်ရန်လိုသော Draft Order များကို ဒီနေရာမှာ အရင်စစ်နိုင်ပါတယ်။</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <button type="button" onClick={() => setStatusFilter("NEEDS_CUSTOMER")} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 hover:bg-amber-100">Customer မတွေ့သေး ({customerOrderSummary.needsCustomerCount})</button>
              <button type="button" onClick={() => setStatusFilter("NEEDS_REVIEW")} className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-orange-800 hover:bg-orange-100">ပြန်စစ်ရန် ({customerOrderSummary.needsReviewCount})</button>
            </div>
          </div>
          {customerOrderSummary.pendingOrders.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">စစ်ဆေးရန်လိုသော Customer Order မရှိသေးပါ။</p> : <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {customerOrderSummary.pendingOrders.slice(0, 6).map((order) => {
              const orderHref = `/orders?status=${encodeURIComponent(order.status)}&orderId=${encodeURIComponent(order.id)}#order-${encodeURIComponent(order.id)}`;
              const lineSummary = (order.lines || []).slice(0, 2).map((line) => `${line.bottleType || "ဘူး"} ${line.capacityLabel || ""} · ${line.cardCount || "?"} ကဒ်`).join("၊ ");
              return <article key={order.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 truncate font-bold text-slate-900">{order.customer?.name || order.draftCustomerName || "Customer မသတ်မှတ်ရသေး"}</h3><span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${STATUS_STYLES[order.status] || STATUS_STYLES.DRAFT}`}>{STATUS_LABELS[order.status] || order.status}</span></div>
                <p className="mt-2 text-xs text-slate-600">ထုတ်ရမည့်ရက်: {formatDate(order.requestedDate)}</p>
                <p className="mt-1 truncate text-xs text-slate-600">နေရာ: {order.destination || "မသတ်မှတ်ရသေး"}</p>
                {lineSummary ? <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-800">{lineSummary}</p> : null}
                <a href={orderHref} className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100">{order.status === "NEEDS_CUSTOMER" ? "Customer ချိတ်ရန် / အသစ်ထည့်ရန် →" : "Order ပြန်စစ်ရန် →"}</a>
              </article>;
            })}
          </div>}
        </section> : null}

        <section className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <button type="button" onClick={() => { setViewMode("ACTIVE"); setStatusFilter("ALL"); }} className={`rounded-xl border px-4 py-3 text-sm font-bold ${viewMode === "ACTIVE" ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>လက်ရှိ Orders</button>
          <button type="button" onClick={() => { setViewMode("HISTORY"); setStatusFilter("ALL"); }} className={`rounded-xl border px-4 py-3 text-sm font-bold ${viewMode === "HISTORY" ? "border-indigo-700 bg-indigo-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>Order History</button>
          <button type="button" onClick={() => { setViewMode("TRASH"); setStatusFilter("ALL"); }} className={`rounded-xl border px-4 py-3 text-sm font-bold ${viewMode === "TRASH" ? "border-rose-700 bg-rose-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>အမှိုက်ပုံး <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5">{trashCount}</span></button>
          <p className="flex items-center px-2 text-xs text-slate-500">Order History နဲ့ အမှိုက်ပုံးက မဖျက်ဘဲ သီးခြားသိမ်းထားတဲ့ Order မှတ်တမ်းများ ဖြစ်ပါတယ်။</p>
        </section>

        {viewMode === "ACTIVE" ? <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700">Customer မတွေ့သေး</p><p className="mt-1 text-2xl font-bold text-amber-900">{counts.NEEDS_CUSTOMER || 0}</p></div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4"><p className="text-xs font-semibold text-orange-700">ပြန်စစ်ရန်</p><p className="mt-1 text-2xl font-bold text-orange-900">{counts.NEEDS_REVIEW || 0}</p></div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-semibold text-violet-700">မနက် batch queue</p><p className="mt-1 text-2xl font-bold text-violet-900">{counts.BATCH_QUEUED || 0}</p></div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-700">အတည်ပြုပြီး</p><p className="mt-1 text-2xl font-bold text-blue-900">{(counts.CONFIRMED || 0) + (counts.FACTORY_NOTIFIED || 0)}</p></div>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="font-semibold text-violet-950">မနက် batch ပို့ခြင်း</h2>
              <p className="mt-1 text-sm text-violet-800">Daily Report ပြီး ၁၀ မိနစ်အကြာ၊ Myanmar Time 08:10 တွင် batch queue ထဲက Confirmed Order များကို စက်ရုံ group သို့ ပို့ပါမယ်။ Notification ကို default ဖွင့်ထားပြီး လိုအပ်ရင် ဒီနေရာမှာ ပိတ်နိုင်ပါတယ်။</p>
            </div>
            <button type="button" onClick={() => saveAutomation(!automation.morningBatchEnabled)} disabled={savingAutomation} className={`shrink-0 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm ${automation.morningBatchEnabled ? "bg-violet-700 hover:bg-violet-800" : "bg-slate-700 hover:bg-slate-800"}`}>
              {savingAutomation ? "သိမ်းနေသည်..." : automation.morningBatchEnabled ? "Batch ဖွင့်ထားသည်" : "Batch ပိတ်ထားသည်"}
            </button>
          </section>
        </> : viewMode === "TRASH" ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5"><h2 className="font-semibold text-rose-950">အမှိုက်ပုံး — Cancelled Orders</h2><p className="mt-1 text-sm text-rose-800">Cancel လုပ်ထားသော Order များကို ဒီနေရာမှာ ၁၅ ရက်အထိ ထိန်းသိမ်းထားပါမယ်။ Cancel လုပ်တဲ့ရက်ကနေ ၁၅ ရက်အတွင်း Restore လုပ်နိုင်ပြီး သက်တမ်းကျော်ပါက auto clear လုပ်ပါမယ်။</p></section> : <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5"><h2 className="font-semibold text-indigo-950">Order History</h2><p className="mt-1 text-sm text-indigo-800">Order စမ်းသပ်မှတ်တမ်းများ၊ Confirm မှတ်တမ်းများနှင့် History သို့ ရွှေ့ထားသော Order များကို ဒီနေရာမှာပဲ ကြည့်နိုင်ပါတယ်။ Activity History ထဲမှာ Order မှတ်တမ်းများ မထပ်ပြတော့ပါ။</p></section>}

        {viewMode !== "TRASH" ? <section className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <p className="mr-2 flex items-center text-sm font-semibold text-slate-700">Filter:</p>
          {["ALL", "NEEDS_CUSTOMER", "NEEDS_REVIEW", "DRAFT", "CONFIRMED", "BATCH_QUEUED", "FACTORY_NOTIFIED", "PREPARED", "COMPLETED"].map((status) => (
            <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${statusFilter === status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
              {status === "ALL" ? "အားလုံး" : STATUS_LABELS[status] || status}
            </button>
          ))}
        </section> : null}

        {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">Order များကို ရယူနေပါသည်...</section> : null}
        {!loading && !filteredOrders.length ? <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">ဒီ filter အတွက် Order မရှိသေးပါ။</section> : null}

        <section className="grid gap-4 xl:grid-cols-2">
          {filteredOrders.map((order) => {
            const draft = draftCustomers[order.id] || {};
            const candidates = candidateMap[order.id] || [];
            const highlighted = selectedOrderId === order.id;
            const busy = workingId === order.id;
            const details = detailEdits[order.id] || {};
            const archived = Boolean(order.archivedAt || order.isArchived);
            const canEditDetails = viewMode === "ACTIVE" && !archived && !["FACTORY_NOTIFIED", "COMPLETED", "CANCELLED"].includes(order.status);
            const lifecycleLogs = orderLogsById.get(String(order.id)) || [];
            return (
              <article key={order.id} id={`order-${order.id}`} className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${highlighted ? "border-emerald-500 ring-2 ring-emerald-200" : archived ? "border-indigo-200" : "border-slate-200"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order #{String(order.id).slice(0, 8)}</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">{order.customer?.name || order.draftCustomerName || "Customer မသတ်မှတ်ရသေး"}</h2>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {archived ? <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-800">History ထဲရှိ</span> : null}
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLES[order.status] || STATUS_STYLES.DRAFT}`}>{STATUS_LABELS[order.status] || order.status}</span>
                  </div>
                </div>

                {archived ? <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">History သို့ရွှေ့ချိန်: {formatMyanmarDateTime(order.archivedAt)} · လုပ်သူ: {order.archivedBy || "Staff"}</p> : null}
                {viewMode === "TRASH" ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">Cancel လုပ်ချိန်: {order.cancelledAt ? formatMyanmarDateTime(order.cancelledAt) : "မသိရသေးပါ"} · လုပ်သူ: {order.cancelledBy || "Staff"} · {retentionLabel(order.cancelledAt)}</p> : null}
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">ထုတ်ရမည့်ရက်</p><p className="font-semibold text-slate-800">{formatDate(order.requestedDate)}</p></div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">ကားဂိတ်/နေရာ</p><p className="font-semibold text-slate-800">{order.destination || "မသတ်မှတ်ရသေး"}</p></div>
                </div>
                {canEditDetails ? <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                  <p className="font-semibold text-cyan-950">Order အချက်အလက် ပြင်ရန်</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-cyan-900">ထုတ်ရမည့်ရက်<input type="date" value={details.requestedDate ?? order.requestedDate ?? ""} onChange={(event) => setDetailField(order.id, "requestedDate", event.target.value)} className="mt-1 w-full rounded-lg border border-cyan-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label>
                    <label className="text-xs font-semibold text-cyan-900">ကားဂိတ်/နေရာ<input value={details.destination ?? order.destination ?? ""} onChange={(event) => setDetailField(order.id, "destination", event.target.value)} placeholder="နေရာ" className="mt-1 w-full rounded-lg border border-cyan-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label>
                    <label className="text-xs font-semibold text-cyan-900">ဖုန်း (ရှိလျှင်)<input value={details.customerPhone ?? order.customerPhone ?? ""} onChange={(event) => setDetailField(order.id, "customerPhone", event.target.value)} placeholder="ဖုန်းနံပါတ်" className="mt-1 w-full rounded-lg border border-cyan-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label>
                  </div>
                  <button type="button" onClick={() => saveOrderDetails(order)} disabled={busy} className="mt-3 rounded-lg border border-cyan-400 bg-white px-3 py-2 text-sm font-bold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50">အချက်အလက် သိမ်းရန်</button>
                </div> : null}
                <OrderLines order={order} />
                <CapLines order={order} />

                {viewMode === "ACTIVE" && order.status === "NEEDS_CUSTOMER" && !archived ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="font-semibold text-amber-900">Customer အသစ်ထည့်ရန် / ရှိပြီးသားနှင့်ချိတ်ရန်</p>
                    <p className="mt-1 text-xs text-amber-800">ဒီ Order ကို Customer match မတွေ့သေးသောကြောင့် Draft အဖြစ်သာထားပါသည်။</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <input value={draft.name ?? order.draftCustomerName ?? ""} onChange={(event) => setDraftField(order.id, "name", event.target.value)} placeholder="Customer အမည်" className="min-w-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900" />
                      <input value={draft.phone ?? order.draftCustomerPhone ?? ""} onChange={(event) => setDraftField(order.id, "phone", event.target.value)} placeholder="ဖုန်းနံပါတ် (ရှိလျှင်)" className="min-w-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => patchOrder(order.id, "create_customer", { name: draft.name ?? order.draftCustomerName, phone: draft.phone ?? order.draftCustomerPhone })} disabled={busy} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-50">Customer အသစ်ဖန်တီးရန်</button>
                      <button type="button" onClick={() => findCandidates(order)} disabled={candidateLoadingId === order.id} className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50">{candidateLoadingId === order.id ? "ရှာနေသည်..." : "ရှိပြီးသားရှာရန်"}</button>
                    </div>
                    {candidates.length ? <div className="mt-3 space-y-2">{candidates.map((candidate) => <button key={candidate.id} type="button" onClick={() => patchOrder(order.id, "link_customer", { customerId: candidate.id })} disabled={busy} className="flex w-full items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-sm hover:bg-amber-100 disabled:opacity-50"><span><strong>{candidate.name}</strong>{candidate.phone ? ` · ${candidate.phone}` : ""}</span><span className="text-xs font-bold text-amber-800">ဒီ Customer ချိတ်ရန်</span></button>)}</div> : null}
                  </div>
                ) : null}

                {viewMode === "ACTIVE" && !archived ? <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {(order.status === "DRAFT" || order.status === "NEEDS_REVIEW") && !order.missingFields?.length ? <><button type="button" onClick={() => patchOrder(order.id, "confirm", { mode: "IMMEDIATE" })} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Confirm — ချက်ချင်းပို့</button><button type="button" onClick={() => patchOrder(order.id, "confirm", { mode: "MORNING_BATCH" })} disabled={busy} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">Confirm — မနက် batch</button></> : null}
                  {!["CONFIRMED", "BATCH_QUEUED", "FACTORY_NOTIFIED", "PREPARED", "COMPLETED", "CANCELLED"].includes(order.status) && order.sourceText ? <button type="button" onClick={() => patchOrder(order.id, "retry_ai")} disabled={busy} className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-800 hover:bg-orange-100 disabled:opacity-50">{busy ? "AI စစ်နေသည်..." : "AI ဖြင့် ပြန်စစ်ရန်"}</button> : null}
                  {(order.status === "CONFIRMED" || order.status === "BATCH_QUEUED") ? <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Confirm ပြီးပါပြီ။ Factory notification state ကို စောင့်ကြည့်ပါ။</span> : null}
                  {order.status !== "CANCELLED" && order.status !== "FACTORY_NOTIFIED" && order.status !== "COMPLETED" ? <button type="button" onClick={() => patchOrder(order.id, "cancel")} disabled={busy} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">Cancel</button> : null}
                  {ARCHIVABLE_STATUSES.includes(order.status) ? <button type="button" onClick={() => archive(order)} disabled={busy} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50">History သို့ရွှေ့</button> : null}
                </div> : null}

                {viewMode === "TRASH" ? <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => patchOrder(order.id, "trash_restore")} disabled={busy || retentionLabel(order.cancelledAt) === "Restore သက်တမ်းကုန်နေပါပြီ"} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-50">Restore ပြန်ယူရန်</button><span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Restore ပြီးရင် Draft အဖြစ် ပြန်ဝင်ပါမယ်။</span></div> : null}

                {viewMode !== "ACTIVE" && viewMode !== "TRASH" ? <>
                  {archived ? <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => patchOrder(order.id, "restore")} disabled={busy} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-50">History မှ ပြန်ယူရန်</button><span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">ပြန်ယူပြီးနောက် မူရင်း {STATUS_LABELS[order.status] || order.status} status အတိုင်းပဲ ရှိပါမယ်။</span></div> : null}
                  <OrderHistoryTimeline logs={lifecycleLogs} />
                </> : null}
                {viewMode === "TRASH" ? <OrderHistoryTimeline logs={lifecycleLogs} /> : null}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
