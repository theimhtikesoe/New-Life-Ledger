"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
// import KPISummaryDashboard from "./KPISummaryDashboard";
import TransactionFilter from "./TransactionFilter";
import OverdueNotificationBell from "./OverdueNotificationBell";
import { formatMyanmarClock, formatMyanmarDateLabel, formatMyanmarDateTime } from "@/lib/myanmar-time-client";
import { encodeActorHeader } from "@/lib/actor-header";
import { cashSaleTypeLabel } from "@/lib/cash-sale-utils";
import LedgerPulse from "@/components/LedgerPulse";
import DailySalesSummaryPanel from "@/components/DailySalesSummaryPanel";
import OverdueAlertAudio from "@/components/OverdueAlertAudio";


const money = new Intl.NumberFormat("en-US");
const today = new Date().toISOString().slice(0, 10);
const AUTO_RETRY_DELAY_MS = 8000;
const RESUME_REFRESH_AFTER_MS = 30000;
const API_REQUEST_TIMEOUT_MS = 20000;
const MAX_GET_ATTEMPTS = 2;
const DASHBOARD_DRAFT_STORAGE_PREFIX = "new-life-ledger-dashboard-draft-v1";

function getDashboardDraftStorageKey(actorName) {
  return actorName ? `${DASHBOARD_DRAFT_STORAGE_PREFIX}-${encodeURIComponent(actorName)}` : "";
}

function clearDashboardDraftFields(fields) {
  if (typeof window === "undefined") return;
  try {
    const actorName = localStorage.getItem("actorName");
    const draftKey = getDashboardDraftStorageKey(actorName);
    if (!draftKey) return;
    const rawDraft = sessionStorage.getItem(draftKey);
    if (!rawDraft) return;
    const draft = JSON.parse(rawDraft);
    fields.forEach((field) => delete draft[field]);
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
  } catch (error) {
    console.warn("Dashboard draft could not be cleared:", error);
  }
}

function formatMoney(value) {
  return `${money.format(Number(value || 0))} Ks`;
}

function getBalanceLabel(value) {
  const amount = Number(value || 0);
  if (amount > 0) return "လက်ကျန်အကြွေး";
  if (amount < 0) return "ကြိုတင်ငွေချေ လက်ကျန်";
  return "လက်ကျန်မရှိ";
}

function formatBalanceAmount(value) {
  return formatMoney(Math.abs(Number(value || 0)));
}

function formatDate(value) {
  return formatMyanmarDateTime(value);
}

function formatMyanmarDateInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

function getPreviousMyanmarDateInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() + (6 * 60 + 30) * 60 * 1000);
  const previous = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - 1));
  return formatMyanmarDateInputValue(new Date(previous.getTime() - (6 * 60 + 30) * 60 * 1000));
}

function friendlyError(error) {
  const message = String(error?.message || "").trim();
  if (error?.name === "TypeError" || error?.name === "TimeoutError" || /^(Type error|Failed to fetch|NetworkError|Load failed|Request timed out)$/i.test(message)) {
    return "အင်တာနက် သို့မဟုတ် server connection ခဏမတည်ငြိမ်ပါ။ ပြန်စမ်းမည်ကို နှိပ်ပြီး ထပ်မံရယူပါ။";
  }
  return message || "အချက်အလက်ရယူရာတွင် အမှားအယွင်းဖြစ်နေပါသည်။";
}

function isRetryableNetworkError(error) {
  const message = String(error?.message || "").trim();
  return error?.name === "TypeError" || error?.name === "TimeoutError" || /^(Type error|Failed to fetch|NetworkError|Load failed|Request timed out)$/i.test(message);
}

async function fetchWithTimeout(path, options, parentSignal, timeoutMs = API_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const relayAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) relayAbort();
    else parentSignal.addEventListener("abort", relayAbort, { once: true });
  }

  try {
    return await fetch(path, { ...options, signal: controller.signal });
  } catch (error) {
    if (timedOut && error.name === "AbortError") {
      error.name = "TimeoutError";
      error.message = "Request timed out";
      error.retryable = true;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", relayAbort);
  }
}

function waitBeforeRetry(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    if (!signal) return;
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException("Request aborted", "AbortError"));
    };
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
  });
}

async function api(path, options) {
  const { signal, timeoutMs = API_REQUEST_TIMEOUT_MS, ...restOptions } = options || {};
  const method = String(restOptions.method || "GET").toUpperCase();
  const canRetry = method === "GET";
  const actorName = typeof window !== "undefined" ? localStorage.getItem("actorName") : "";
  // Myanmar mobile/VPN paths can take longer than one cold-start response.
  // Keep writes single-attempt, but allow GETs enough time and retries to recover.
  const maxAttempts = canRetry ? MAX_GET_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(path, {
        headers: {
          "Content-Type": "application/json",
          ...(actorName ? { "x-actor-name": encodeActorHeader(actorName) } : {}),
        },
        ...restOptions,
      }, signal, timeoutMs);
      const text = await response.text();
      let body = {};

      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = { error: text };
        }
      }

      if (!response.ok) {
        const error = new Error(body.error || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.code = response.status === 401 ? "AUTH_REQUIRED" : undefined;
        error.retryable = response.status >= 500;
        throw error;
      }

      return body.data;
    } catch (error) {
      if (error.name === "AbortError" || attempt === maxAttempts || (!error.retryable && !isRetryableNetworkError(error))) {
        throw error;
      }
      await waitBeforeRetry(500 * attempt, signal);
    }
  }

  throw new Error("Request failed");
}

const DASHBOARD_SNAPSHOT_KEY = "new-life-ledger:dashboard-snapshot:v1";

function readDashboardSnapshot() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DASHBOARD_SNAPSHOT_KEY);
    const snapshot = raw ? JSON.parse(raw) : null;
    return snapshot && typeof snapshot === "object" ? snapshot : null;
  } catch {
    return null;
  }
}

function saveDashboardSnapshot(partial) {
  if (typeof window === "undefined" || !partial || typeof partial !== "object") return;
  try {
    const current = readDashboardSnapshot() || {};
    window.sessionStorage.setItem(DASHBOARD_SNAPSHOT_KEY, JSON.stringify({ ...current, ...partial, savedAt: Date.now() }));
  } catch (error) {
    console.warn("Dashboard snapshot could not be saved:", error);
  }
}

// Alert notification component
function AlertNotification({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "success" ? "bg-emerald-950/60 border-emerald-900" : "bg-rose-950/60 border-rose-900";
  const textColor = type === "success" ? "text-emerald-200" : "text-rose-200";

  return (
    <div className={`pwa-top-alert fixed right-4 z-40 rounded-md border px-4 py-3 text-sm ${bgColor} ${textColor} shadow-lg`}>
      {message}
    </div>
  );
}

export function mergeTransactionsWithCashSales(ledgers = [], cashSales = []) {
  return [
    ...ledgers,
    ...cashSales.map((sale) => ({ ...sale, type: "CASH_SALE", recordType: "CASH_SALE" })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function Dashboard({ view = "overview" }) {
  const isLedgerView = view === "ledger";
  const [customers, setCustomers] = useState(() => readDashboardSnapshot()?.customers || []);
  const [allCustomersForKPI, setAllCustomersForKPI] = useState(() => readDashboardSnapshot()?.allCustomersForKPI || []);
  const [deletedCustomers, setDeletedCustomers] = useState([]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [deletedCustomerDetail, setDeletedCustomerDetail] = useState(null);
  const [loadingDeletedCustomerDetail, setLoadingDeletedCustomerDetail] = useState(false);
  const [deletedCustomerDetailError, setDeletedCustomerDetailError] = useState("");
  const [pendingKpay, setPendingKpay] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState("");
  const [matchingKpay, setMatchingKpay] = useState(null);
  const [matchCustomerId, setMatchCustomerId] = useState("");
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [permanentDeletingCustomer, setPermanentDeletingCustomer] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const [editForm, setEditForm] = useState({ name: "", phone: "", routeTag: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(24);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    routeTag: "",
    current_balance: "",
  });
  const [ledgerForm, setLedgerForm] = useState({
    type: "CREDIT",
    saleType: "RETAIL",
    itemSize: "",
    cartons: "",
    rate: "",
    deductions: "",
    amount: "",
    note: "",
    date: "",
    paymentType: "",
    paymentBreakdown: { CASH: "", KPAY: "", BANK: "", WAVE: "", SPECIAL: "" },
  });
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState("Dashboard data ရယူနေပါသည်");
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [showCustomerList, setShowCustomerList] = useState(true);
  const [message, setMessage] = useState("");
  const [dataLoadError, setDataLoadError] = useState("");
  const [alert, setAlert] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filteredLedgers, setFilteredLedgers] = useState([]);
  const [transactionPagination, setTransactionPagination] = useState({ offset: 0, limit: 50, total: 0, hasMore: false });
  const [loadingMoreTransactions, setLoadingMoreTransactions] = useState(false);
  const [highlightedCustomerId, setHighlightedCustomerId] = useState(null);
  const [todayPaymentsList, setTodayPaymentsList] = useState(() => readDashboardSnapshot()?.todayPaymentsList || []);
  const [todayCashSales, setTodayCashSales] = useState(() => readDashboardSnapshot()?.todayCashSales || []);
  const [overdueDebts, setOverdueDebts] = useState(() => readDashboardSnapshot()?.overdueDebts || null);
  const [dashboardKpi, setDashboardKpi] = useState(() => readDashboardSnapshot()?.dashboardKpi || null);
  const [ledgerPulse, setLedgerPulse] = useState(() => readDashboardSnapshot()?.ledgerPulse || null);
  const [ledgerPulseLoading, setLedgerPulseLoading] = useState(false);
  const [ledgerPulseError, setLedgerPulseError] = useState("");
  const [showTelegramReportModal, setShowTelegramReportModal] = useState(false);
  const [telegramReportStep, setTelegramReportStep] = useState("preview");
  const [telegramReportDate, setTelegramReportDate] = useState(() => getPreviousMyanmarDateInputValue());
  const [telegramReportPreview, setTelegramReportPreview] = useState(null);
  const [telegramReportPin, setTelegramReportPin] = useState("");
  const [telegramReportError, setTelegramReportError] = useState("");
  const [isLoadingTelegramReportPreview, setIsLoadingTelegramReportPreview] = useState(false);
  const [isSendingTelegramReport, setIsSendingTelegramReport] = useState(false);
  const [showTodayPaymentsModal, setShowTodayPaymentsModal] = useState(false);
  const [expandedDashboardMenu, setExpandedDashboardMenu] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [selectedKpiDate, setSelectedKpiDate] = useState(() => formatMyanmarDateInputValue());
  const [kpiDateLoading, setKpiDateLoading] = useState(false);
  const [kpiDateError, setKpiDateError] = useState("");
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === "undefined" ? true : navigator.onLine
  ));
  const [nextAutoRetrySeconds, setNextAutoRetrySeconds] = useState(0);
  const retryTimerRef = useRef(null);
  const retryCountdownRef = useRef(null);
  const kpiDateInitializedRef = useRef(false);
  const kpiDateRequestRef = useRef(0);
  const telegramPreviewRequestRef = useRef(0);
  const telegramPreviewControllerRef = useRef(null);
  const lastDashboardAttemptAtRef = useRef(0);
  const dashboardDraftRestoredRef = useRef(false);
  const dashboardDraftActorRef = useRef("");
  const dashboardDraftRestoredPageRef = useRef(false);
  const dashboardDraftWriteSkipRef = useRef(true);

  const clearAutoRetryTimers = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (retryCountdownRef.current) {
      clearInterval(retryCountdownRef.current);
      retryCountdownRef.current = null;
    }
    setNextAutoRetrySeconds(0);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!kpiDateInitializedRef.current) {
      kpiDateInitializedRef.current = true;
      return undefined;
    }
    if (!selectedKpiDate) return undefined;

    const controller = new AbortController();
    const requestId = kpiDateRequestRef.current + 1;
    kpiDateRequestRef.current = requestId;
    setKpiDateLoading(true);
    setKpiDateError("");

    api(`/api/dashboard-kpi?date=${encodeURIComponent(selectedKpiDate)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((kpi) => {
        if (kpiDateRequestRef.current !== requestId) return;
        setDashboardKpi(kpi);
      })
      .catch((error) => {
        if (error.name !== "AbortError" && kpiDateRequestRef.current === requestId) {
          setKpiDateError("KPI data ပြောင်းလဲရာတွင် အမှားရှိပါသည်။");
        }
      })
      .finally(() => {
        if (kpiDateRequestRef.current === requestId) setKpiDateLoading(false);
      });

    return () => controller.abort();
  }, [selectedKpiDate]);

  // Keep unfinished local work available when the actor-only idle lock appears.
  // Each actor has a separate session draft so shared-phone users do not see one another's form data.
  // sessionStorage survives a refresh in this tab and clears when the tab/PWA session closes.
  // These drafts never include PIN values or server credentials.
  useEffect(() => {
    const resetDraftState = () => {
      setNewCustomer({ name: "", phone: "", routeTag: "", current_balance: "" });
      setLedgerForm({ type: "CREDIT", saleType: "RETAIL", itemSize: "", cartons: "", rate: "", deductions: "", amount: "", note: "", date: "", paymentType: "" });
      setEditForm({ name: "", phone: "", routeTag: "" });
      setEditingCustomer(null);
      setSearch("");
      dashboardDraftRestoredPageRef.current = false;
      setCurrentPage(1);
      setShowAddCustomer(false);
      setShowCustomerList(true);
      setSelectedCustomerId(null);
      setSelectedCustomer(null);
      setMatchingKpay(null);
      setMatchCustomerId("");
      setShowPinModal(false);
      setPinValue("");
      setPinError("");
      setDeletingTransaction(null);
      setShowTelegramReportModal(false);
      setTelegramReportStep("preview");
      setTelegramReportPin("");
      setTelegramReportPreview(null);
      setTelegramReportError("");
      setFilteredLedgers([]);
    };

    const applyDraftForActor = (actorName) => {
      dashboardDraftActorRef.current = actorName || "";
      const draftKey = getDashboardDraftStorageKey(actorName);
      let draft = null;
      try {
        const rawDraft = draftKey ? sessionStorage.getItem(draftKey) : null;
        draft = rawDraft ? JSON.parse(rawDraft) : null;
      } catch (error) {
        console.warn("Dashboard draft could not be restored:", error);
      }

      resetDraftState();
      if (!draft) return;

      if (draft.newCustomer && typeof draft.newCustomer === "object") setNewCustomer((prev) => ({ ...prev, ...draft.newCustomer }));
      if (draft.ledgerForm && typeof draft.ledgerForm === "object") setLedgerForm((prev) => ({ ...prev, ...draft.ledgerForm }));
      if (draft.editForm && typeof draft.editForm === "object") setEditForm((prev) => ({ ...prev, ...draft.editForm }));
      if (draft.matchingKpay && typeof draft.matchingKpay === "object") setMatchingKpay(draft.matchingKpay);
      if (typeof draft.matchCustomerId === "string") setMatchCustomerId(draft.matchCustomerId);
      setEditingCustomer(draft.editingCustomer && typeof draft.editingCustomer === "object" ? draft.editingCustomer : null);
      if (typeof draft.search === "string") setSearch(draft.search);
      if (Number.isFinite(Number(draft.currentPage)) && Number(draft.currentPage) > 0) {
        dashboardDraftRestoredPageRef.current = true;
        setCurrentPage(Math.floor(Number(draft.currentPage)));
      }
      if (typeof draft.showAddCustomer === "boolean") setShowAddCustomer(draft.showAddCustomer);
      if (typeof draft.showCustomerList === "boolean") setShowCustomerList(draft.showCustomerList);
      setSelectedCustomerId(draft.selectedCustomerId || null);
    };

    applyDraftForActor(localStorage.getItem("actorName") || "");
    dashboardDraftRestoredRef.current = true;

    const handleActorSelected = (event) => {
      applyDraftForActor(event.detail?.actorName || localStorage.getItem("actorName") || "");
    };
    window.addEventListener("new-life-ledger:actor-selected", handleActorSelected);
    return () => window.removeEventListener("new-life-ledger:actor-selected", handleActorSelected);
  }, []);

  useEffect(() => {
    if (!isLedgerView || typeof window === "undefined") return;
    const requestedCustomerId = new URLSearchParams(window.location.search).get("customerId");
    if (!requestedCustomerId) return;
    setSelectedCustomerId(requestedCustomerId);
    setShowCustomerList(false);
  }, [isLedgerView]);

  useEffect(() => {
    if (!dashboardDraftRestoredRef.current) return;
    if (dashboardDraftWriteSkipRef.current) {
      dashboardDraftWriteSkipRef.current = false;
      return;
    }
    try {
      const actorName = localStorage.getItem("actorName") || dashboardDraftActorRef.current;
      const draftKey = getDashboardDraftStorageKey(actorName);
      if (!draftKey) return;
      const draft = {
        actorName,
        newCustomer,
        ledgerForm,
        editForm,
        matchingKpay,
        matchCustomerId,
        editingCustomer: editingCustomer
          ? { id: editingCustomer.id, name: editingCustomer.name, phone: editingCustomer.phone, routeTag: editingCustomer.routeTag }
          : null,
        search,
        currentPage,
        showAddCustomer,
        showCustomerList,
        selectedCustomerId,
        savedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch (error) {
      console.warn("Dashboard draft could not be saved:", error);
    }
  }, [newCustomer, ledgerForm, editForm, matchingKpay, matchCustomerId, editingCustomer, search, currentPage, showAddCustomer, showCustomerList, selectedCustomerId]);

  // Auto-scroll and auto-hide list when a customer is selected
  useEffect(() => {
    if (selectedCustomerId) {
      // Hide the customer list to make view clearer
      setShowCustomerList(false);
      
      // Use a small timeout to ensure the DOM has updated and the details section is rendered
      const timer = setTimeout(() => {
        const element = document.getElementById("customer-details-section");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedCustomerId]);


  // Show alert notification
  const showAlert = useCallback((msg, type = "success") => {
    setAlert({ message: msg, type });
  }, []);

  // Hide alert notification
  const hideAlert = useCallback(() => {
    setAlert(null);
  }, []);

  const resetTelegramReportModal = useCallback(() => {
    setShowTelegramReportModal(false);
    setTelegramReportStep("preview");
    setTelegramReportPreview(null);
    setTelegramReportPin("");
    setTelegramReportError("");
    telegramPreviewRequestRef.current += 1;
    telegramPreviewControllerRef.current?.abort();
    telegramPreviewControllerRef.current = null;
    setIsLoadingTelegramReportPreview(false);
    setIsSendingTelegramReport(false);
  }, []);

  const loadTelegramReportPreview = useCallback(async (date) => {
    const requestId = telegramPreviewRequestRef.current + 1;
    telegramPreviewRequestRef.current = requestId;
    telegramPreviewControllerRef.current?.abort();
    const controller = new AbortController();
    telegramPreviewControllerRef.current = controller;
    setTelegramReportPreview(null);
    setTelegramReportError("");
    setIsLoadingTelegramReportPreview(true);
    try {
      const query = new URLSearchParams({ date, refresh: String(Date.now()) });
      const preview = await api(`/api/telegram/manual-report-preview?${query.toString()}`, {
        signal: controller.signal,
        timeoutMs: 12000,
        cache: "no-store",
        credentials: "include",
      });
      if (telegramPreviewRequestRef.current === requestId) {
        setTelegramReportPreview(preview);
      }
    } catch (error) {
      if (telegramPreviewRequestRef.current === requestId) {
        if (error.code === "AUTH_REQUIRED" || error.status === 401) {
          setTelegramReportError("PIN session မရှိတော့ပါ။ Dashboard ကို ပြန်ဝင်ပြီး ထပ်စမ်းပါ။");
        } else if (error.name === "TimeoutError" || error.name === "AbortError") {
          setTelegramReportError("Report preview ရယူရန် အချိန်ကျော်သွားပါပြီ။ ပြန်စမ်းမည် သို့မဟုတ် ပိတ်ရန် နှိပ်ပါ။");
        } else {
          setTelegramReportError(error.message || "Report preview ရယူခြင်း မအောင်မြင်ပါ။");
        }
      }
    } finally {
      if (telegramPreviewRequestRef.current === requestId) {
        telegramPreviewControllerRef.current = null;
        setIsLoadingTelegramReportPreview(false);
      }
    }
  }, []);

  const handleOpenTelegramReportPreview = useCallback(() => {
    const defaultDate = getPreviousMyanmarDateInputValue();
    setShowTelegramReportModal(true);
    setTelegramReportStep("preview");
    setTelegramReportDate(defaultDate);
    setTelegramReportPin("");
    loadTelegramReportPreview(defaultDate);
  }, [loadTelegramReportPreview]);

  const handleTelegramReportDateChange = useCallback((event) => {
    const nextDate = event.target.value;
    setTelegramReportDate(nextDate);
    setTelegramReportStep("preview");
    setTelegramReportPin("");
    if (!nextDate) {
      telegramPreviewRequestRef.current += 1;
      setTelegramReportPreview(null);
      setTelegramReportError("Report date ရွေးပေးပါ။");
      setIsLoadingTelegramReportPreview(false);
      return;
    }
    loadTelegramReportPreview(nextDate);
  }, [loadTelegramReportPreview]);

  const handleProceedToTelegramPin = useCallback(() => {
    if (!telegramReportPreview) return;
    setTelegramReportStep("pin");
    setTelegramReportError("");
  }, [telegramReportPreview]);

  const handleManualTelegramReport = useCallback(async (event) => {
    event.preventDefault();
    const pin = telegramReportPin.trim();
    if (!pin || isSendingTelegramReport) return;

    setIsSendingTelegramReport(true);
    setTelegramReportError("");
    try {
      const actorName = typeof window !== "undefined" ? localStorage.getItem("actorName") || "" : "";
      const result = await api("/api/telegram/manual-report", {
        method: "POST",
        timeoutMs: 20000,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pin}`,
          ...(actorName ? { "x-actor-name": encodeActorHeader(actorName) } : {}),
        },
        body: JSON.stringify({ date: telegramReportPreview?.date }),
      });
      resetTelegramReportModal();
      const sentDate = result?.date || telegramReportPreview?.date;
      if (result?.skipped) {
        showAlert(`${sentDate} ငွေရှင်းတမ်းကို အရင်ပို့ပြီးသားဖြစ်လို့ ထပ်မပို့တော့ပါ။ Auto Report status တွင် စစ်နိုင်ပါသည်။`, "info");
      } else {
        showAlert(`${sentDate} ငွေရှင်းတမ်းကို Telegram group သို့ ပို့ပြီးပါပြီ။`, "success");
      }
    } catch (error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        setTelegramReportError("Telegram report ပို့ရန် အချိန်ကျော်သွားပါပြီ။ ထပ်မပို့မီ Auto Report အခြေအနေတွင် duplicate run ရှိ/မရှိ စစ်ပါ။");
      } else {
        setTelegramReportError(error.message || "Telegram report ပို့ခြင်း မအောင်မြင်ပါ။");
      }
    } finally {
      setIsSendingTelegramReport(false);
    }
  }, [isSendingTelegramReport, resetTelegramReportModal, showAlert, telegramReportPin, telegramReportPreview]);

  const loadOverdueDebts = useCallback(async () => {
    // This is a non-critical background request. It must never leave the bell
    // in an infinite loading state if the database or network is slow.
    try {
      const overdueRows = await api(`/api/overdue-debts?refresh=${Date.now()}`, {
        timeoutMs: 20000,
        cache: "no-store",
      });
      const rows = Array.isArray(overdueRows) ? overdueRows : [];
      setOverdueDebts(rows);
      saveDashboardSnapshot({ overdueDebts: rows });
    } catch (error) {
      console.warn("Overdue debts were not loaded:", error);
      // Keep the last successful snapshot; if none exists, explicitly resolve
      // to an empty state so the bell cannot remain stuck on “ရယူနေသည်...”.
      setOverdueDebts((current) => current ?? []);
    }
  }, []);

  const loadDashboard = useCallback(async (signal) => {
    lastDashboardAttemptAtRef.current = Date.now();
    setLoading(true);
    setDataLoadError("");
    setLoadingStage("KPI အချက်အလက်များ ရယူနေပါသည်");
    try {
      // Stage 1: fetch only small aggregate values so KPI cards can paint first.
      const kpi = await api("/api/dashboard-kpi", { signal });
      setDashboardKpi(kpi);
      saveDashboardSnapshot({ dashboardKpi: kpi });

      // Stage 2 starts immediately after KPI. It is independent of the main
      // customer list, so the ledger can render without waiting for slow alerts.
      setLoadingStage("အကြွေးသတိပေးချက်များ ရယူနေပါသည်");
      void loadOverdueDebts();

      // Stage 3: load the lightweight customer/ledger index. Keep the previous
      // snapshot visible while this request is running so navigation/refresh
      // never turns a populated screen into a false empty state.
      setLoadingStage("ငွေရှင်းတမ်းနှင့် Customer data ရယူနေပါသည်");
      const customerRequest = api(`/api/customers?includeLedgers=false${search ? `&q=${encodeURIComponent(search)}` : ""}`, { signal });
      const allCustomersRequest = search ? api("/api/customers?includeLedgers=false", { signal }) : customerRequest;
      const [customerRows, allCustomersRows] = await Promise.all([
        customerRequest,
        allCustomersRequest,
      ]);
      setCustomers(customerRows);
      setAllCustomersForKPI(allCustomersRows);
      saveDashboardSnapshot({ customers: customerRows, allCustomersForKPI: allCustomersRows });
      setMessage("");
      setDataLoadError("");
      clearAutoRetryTimers();

      // Stage 4: detailed daily values are intentionally background work.
      setLoadingStage("ယနေ့ ငွေချေ/လက်ငင်း data ရယူနေပါသည်");
      void api("/api/daily-summary", { signal })
        .then((summary) => {
          const phoneByCustomerId = new Map(allCustomersRows.map((customer) => [customer.id, customer.phone]));
          const payments = (summary.transactions || [])
            .filter((transaction) => transaction.type === "DEBIT")
            .map((transaction) => ({
              ...transaction,
              customerId: transaction.customer?.id,
              customerName: transaction.customer?.name || "",
              customerPhone: phoneByCustomerId.get(transaction.customer?.id) || null,
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          const cashSales = Array.isArray(summary.cashSales) ? summary.cashSales : [];
          setTodayPaymentsList(payments);
          setTodayCashSales(cashSales);
          saveDashboardSnapshot({ todayPaymentsList: payments, todayCashSales: cashSales });
        })
        .catch((error) => {
          if (error.name !== "AbortError") console.warn("Today summary was not loaded:", error);
        });

      // Stage 5: secondary KPay data is loaded last and never blocks the main UI.
      setLoadingStage("ကျန်ရှိသော data များ ရယူနေပါသည်");
      void api("/api/unverified-kpay?status=PENDING", { signal })
        .then((kpayRows) => setPendingKpay(kpayRows))
        .catch((error) => {
          if (error.name !== "AbortError") console.warn("Pending KPay data was not loaded:", error);
        });

      // Stage 6: the visual pulse is non-critical and loads after the main data.
      setLedgerPulseLoading(true);
      setLedgerPulseError("");
      void api("/api/dashboard-pulse?days=7", { signal, cache: "no-store", timeoutMs: 20000 })
        .then((payload) => {
          const pulse = payload || null;
          setLedgerPulse(pulse);
          saveDashboardSnapshot({ ledgerPulse: pulse });
        })
        .catch((error) => {
          if (error.name === "AbortError") return;
          console.warn("Ledger Pulse data was not loaded:", error);
          setLedgerPulseError(error.message || "Ledger Pulse data မရသေးပါ။");
        })
        .finally(() => setLedgerPulseLoading(false));
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (error.code === "AUTH_REQUIRED" || error.status === 401) {
        const message = "PIN session သက်တမ်းကုန်ပါပြီ။ Data ပြန်ရယူရန် PIN ထည့်ပါ။";
        setDataLoadError("");
        setMessage(message);
        setShowPinModal(true);
        return;
      }
      console.error("Dashboard data loading error:", error);
      const message = friendlyError(error);
      setDataLoadError(message);
      setMessage(message);
      showAlert(message, "error");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  }, [clearAutoRetryTimers, loadOverdueDebts, search, showAlert]);

  // iPhone standalone PWAs can pause while they are in the background. Refresh
  // when the app becomes visible again, or immediately when the connection returns.
  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine !== false);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const refreshOnResume = () => {
      if (document.visibilityState === "hidden" || navigator.onLine === false || loading) return;
      const hasConnectionError = Boolean(dataLoadError);
      const dataIsStale = Date.now() - lastDashboardAttemptAtRef.current >= RESUME_REFRESH_AFTER_MS;
      if (hasConnectionError || dataIsStale) {
        loadDashboard();
      }
    };

    window.addEventListener("pageshow", refreshOnResume);
    window.addEventListener("online", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnResume);
    return () => {
      window.removeEventListener("pageshow", refreshOnResume);
      window.removeEventListener("online", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnResume);
    };
  }, [dataLoadError, loadDashboard, loading]);

  // Keep retrying a failed initial load in the foreground instead of leaving
  // the Home Screen app stuck on the connection-error panel.
  useEffect(() => {
    clearAutoRetryTimers();
    if (!dataLoadError || !isOnline) return undefined;

    let secondsRemaining = Math.ceil(AUTO_RETRY_DELAY_MS / 1000);
    setNextAutoRetrySeconds(secondsRemaining);
    retryCountdownRef.current = setInterval(() => {
      secondsRemaining -= 1;
      setNextAutoRetrySeconds(Math.max(secondsRemaining, 0));
    }, 1000);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (document.visibilityState === "hidden" || navigator.onLine === false) return;
      setMessage("ချိတ်ဆက်နေပါသည်။ အချက်အလက်များကို အလိုအလျောက် ပြန်လည်ရယူနေပါသည်။");
      loadDashboard();
    }, AUTO_RETRY_DELAY_MS);

    return clearAutoRetryTimers;
  }, [clearAutoRetryTimers, dataLoadError, isOnline, loadDashboard]);

  const loadDeletedCustomers = useCallback(async () => {
    setLoadingDeleted(true);
    try {
      const deletedRows = await api("/api/customers?deleted=true&includeLedgers=false");
      setDeletedCustomers(deletedRows);
    } catch (error) {
      showAlert(error.message, "error");
    } finally {
      setLoadingDeleted(false);
    }
  }, [showAlert]);

  async function openDeletedCustomerDetail(customer) {
    setDeletedCustomerDetailError("");
    setDeletedCustomerDetail({ ...customer, ledgers: [], kpayAliases: [] });
    setLoadingDeletedCustomerDetail(true);
    try {
      const detail = await api(`/api/customers/${encodeURIComponent(customer.id)}?includeLedgers=true`);
      setDeletedCustomerDetail(detail);
    } catch (error) {
      setDeletedCustomerDetailError(error.message || "Customer အသေးစိတ် ရယူ၍ မရပါ။");
    } finally {
      setLoadingDeletedCustomerDetail(false);
    }
  }

  useEffect(() => {
    if (showRecycleBin) {
      loadDeletedCustomers();
    }
  }, [showRecycleBin, loadDeletedCustomers]);

  // Trigger search when search input changes
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      loadDashboard(controller.signal);
    }, 300); // Debounce search by 300ms
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, loadDashboard]);

  const loadCustomer = useCallback(async (id = selectedCustomerId) => {
    if (!id) {
      setSelectedCustomer(null);
      return;
    }

    setLoadingCustomer(true);
    try {
      const [customer, transactionPage] = await Promise.all([
        api(`/api/customers/${id}?includeLedgers=false&includeCashSales=true`),
        api(`/api/customers/${id}/transactions?limit=50&offset=0`),
      ]);
      setSelectedCustomer({ ...customer, cashSales: customer.cashSales || [], ledgers: transactionPage.items || [] });
      setTransactionPagination(transactionPage.pagination || { offset: 0, limit: 50, total: 0, hasMore: false });
      setSelectedCustomerId(customer.id);
    } catch (error) {
      setMessage(error.message);
      showAlert(error.message, "error");
    } finally {
      setLoadingCustomer(false);
    }
  }, [selectedCustomerId, showAlert]);

  const loadMoreTransactions = useCallback(async () => {
    if (!selectedCustomerId || loadingMoreTransactions || !transactionPagination.hasMore) return;
    setLoadingMoreTransactions(true);
    try {
      const offset = selectedCustomer?.ledgers?.length || transactionPagination.offset;
      const page = await api(`/api/customers/${selectedCustomerId}/transactions?limit=${transactionPagination.limit}&offset=${offset}`);
      setSelectedCustomer((prev) => prev ? { ...prev, ledgers: [...(prev.ledgers || []), ...(page.items || [])] } : prev);
      setTransactionPagination(page.pagination || transactionPagination);
    } catch (error) {
      showAlert(error.message, "error");
    } finally {
      setLoadingMoreTransactions(false);
    }
  }, [selectedCustomerId, selectedCustomer, transactionPagination, loadingMoreTransactions, showAlert]);

  useEffect(() => {
    loadCustomer().catch((error) => {
      setMessage(error.message);
      showAlert(error.message, "error");
    });
  }, [loadCustomer, showAlert]);

  const totalPending = useMemo(
    () => pendingKpay.reduce((sum, item) => sum + item.amount, 0),
    [pendingKpay],
  );

  // Calculate summary metrics
  const totalBalance = useMemo(
    () => allCustomersForKPI.reduce((sum, customer) => sum + (customer.current_balance || 0), 0),
    [allCustomersForKPI],
  );

  const customerCount = useMemo(
    () => allCustomersForKPI.length,
    [allCustomersForKPI],
  );

    const hasKpiSnapshot = Boolean(dashboardKpi);
  const currentMyanmarDate = formatMyanmarDateInputValue(currentTime);
  const selectedKpiIsToday = selectedKpiDate === currentMyanmarDate;
  const displayedTotalBalance = dashboardKpi?.totalBalance ?? totalBalance;
  const displayedCustomerCount = dashboardKpi?.totalCustomers ?? customerCount;
  const todayTransactions = dashboardKpi?.todayPaidCount ?? todayPaymentsList.length;
  const todayCashAmount = dashboardKpi?.amount ?? todayCashSales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const todayCashCount = dashboardKpi?.count ?? todayCashSales.length;
  const todayCashRetail = dashboardKpi?.retailCount ?? todayCashSales.filter((sale) => String(sale.saleType || "RETAIL").toUpperCase() !== "WHOLESALE").length;
  const todayCashWholesale = dashboardKpi?.wholesaleCount ?? (todayCashSales.length - todayCashRetail);

  // Pagination logic
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return customers.slice(startIndex, endIndex);
  }, [customers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(customers.length / itemsPerPage);

  // Reset to first page when search changes
  useEffect(() => {
    if (dashboardDraftRestoredPageRef.current) {
      dashboardDraftRestoredPageRef.current = false;
      return;
    }
    setCurrentPage(1);
  }, [search]);

  async function createCustomer(event) {
    event.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      setMessage("");
      const customer = await api("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          ...newCustomer,
          current_balance: Number(newCustomer.current_balance || 0),
        }),
      });
      
      // Optimistic Update: Add new customer to the list immediately
      setCustomers(prev => [...prev, customer].sort((a, b) => a.name.localeCompare(b.name, 'my')));
      setAllCustomersForKPI(prev => [...prev, customer].sort((a, b) => a.name.localeCompare(b.name, 'my')));
      setNewCustomer({ name: "", phone: "", routeTag: "", current_balance: "" });
      clearDashboardDraftFields(["newCustomer"]);
      setSelectedCustomerId(customer.id);
      setShowAddCustomer(false);
      showAlert(`Customer "${customer.name}" အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။`, "success");
    } catch (error) {
      setMessage(error.message);
      showAlert(error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createLedgerTransaction(event) {
    event.preventDefault();
    if (!selectedCustomerId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      setMessage("");
      const amount = Number(ledgerForm.amount);
      const type = ledgerForm.type;
      const isCashSale = type === "CASH_SALE";
      
      // Cash sales are stored outside Ledger and never change Customer.current_balance.
      if (!isCashSale) {
        const balanceDelta = type === "CREDIT" ? amount : -amount;
        const newBalance = (selectedCustomer?.current_balance || 0) + balanceDelta;
        setSelectedCustomer(prev => ({ ...prev, current_balance: newBalance }));
        setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? { ...c, current_balance: newBalance } : c));
        setAllCustomersForKPI(prev => prev.map(c => c.id === selectedCustomerId ? { ...c, current_balance: newBalance } : c));
      }
      
      const result = await api(isCashSale ? `/api/customers/${selectedCustomerId}/cash-sales` : `/api/customers/${selectedCustomerId}/transactions`, {
        method: "POST",
        body: JSON.stringify({
          type: ledgerForm.type,
          saleType: ledgerForm.saleType,
          itemSize: ledgerForm.itemSize,
          cartons: Number(ledgerForm.cartons || 0) || null,
          rate: Number(ledgerForm.rate || 0) || null,
          deductions: Number(ledgerForm.deductions || 0),
          amount: Number(ledgerForm.amount),
          note: ledgerForm.note,
          paymentType: ledgerForm.paymentType || (isCashSale ? "CASH" : null),
          date: ledgerForm.date || null,
          ...(isCashSale ? {
            paymentBreakdown: Object.fromEntries(
              Object.entries(ledgerForm.paymentBreakdown || {}).map(([key, value]) => [key, Number(value || 0)])
            ),
          } : {}),
        }),
      });
      
      if (isCashSale && result?.cashSale) {
        setSelectedCustomer(prev => ({ ...prev, cashSales: [result.cashSale, ...(prev.cashSales || [])] }));
      }
      if (!isCashSale && result?.ledger) {
        setSelectedCustomer(prev => ({ ...prev, ledgers: [result.ledger, ...(prev.ledgers || [])] }));
        setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? { ...c, ledgers: [result.ledger, ...(c.ledgers || [])] } : c));
        setAllCustomersForKPI(prev => prev.map(c => c.id === selectedCustomerId ? { ...c, ledgers: [result.ledger, ...(c.ledgers || [])] } : c));
      }
      
      // Clear form immediately after successful submission
      setLedgerForm({
        type: "CREDIT",
        saleType: "RETAIL",
        itemSize: "",
        cartons: "",
        rate: "",
        deductions: "",
        amount: "",
        note: "",
        date: "",
        paymentType: "",
        paymentBreakdown: { CASH: "", KPAY: "", BANK: "", WAVE: "", SPECIAL: "" },
      });
      clearDashboardDraftFields(["ledgerForm"]);
      
      showAlert(isCashSale ? "လက်ငင်း Transaction သိမ်းဆည်းပြီးပါပြီ။" : "Transaction အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။", "success");
    } catch (error) {
      setMessage(error.message);
      showAlert(error.message, "error");
      // Revert optimistic update on error
      await loadCustomer(selectedCustomerId);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteTransaction(transaction) {
    const id = typeof transaction === "string" ? transaction : transaction?.id;
    const isCashSale = typeof transaction === "object" && transaction?.type === "CASH_SALE";
    if (!id || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await api(
        isCashSale
          ? `/api/customers/${selectedCustomerId}/cash-sales/${id}`
          : `/api/transactions/${id}`,
        { method: "DELETE" },
      );

      if (result) {
        if (isCashSale) {
          // CashSale is separate from Ledger and must never change the balance.
          setSelectedCustomer((prev) => prev ? {
            ...prev,
            cashSales: (prev.cashSales || []).filter((sale) => sale.id !== id),
          } : prev);
          setCustomers((prev) => prev.map((customer) => (
            customer.id === result.customerId
              ? { ...customer, cashSales: (customer.cashSales || []).filter((sale) => sale.id !== id) }
              : customer
          )));
          setAllCustomersForKPI((prev) => prev.map((customer) => (
            customer.id === result.customerId
              ? { ...customer, cashSales: (customer.cashSales || []).filter((sale) => sale.id !== id) }
              : customer
          )));
        } else {
          setSelectedCustomer((prev) => ({
            ...prev,
            current_balance: result.newBalance,
            ledgers: prev.ledgers.filter((ledger) => ledger.id !== id),
          }));

          setCustomers((prev) =>
            prev.map((customer) =>
              customer.id === result.customerId
                ? {
                    ...customer,
                    current_balance: result.newBalance,
                    ledgers: customer.ledgers?.filter((ledger) => ledger.id !== id),
                  }
                : customer
            )
          );

          setAllCustomersForKPI((prev) =>
            prev.map((customer) =>
              customer.id === result.customerId
                ? {
                    ...customer,
                    current_balance: result.newBalance,
                    ledgers: customer.ledgers?.filter((ledger) => ledger.id !== id),
                  }
                : customer
            )
          );
        }
      }

      showAlert(
        isCashSale
          ? "လက်ငင်းမှတ်တမ်းကို ဖျက်ပြီးပါပြီ။ Customer လက်ကျန် မပြောင်းပါ။"
          : "Transaction ကို ဖျက်ပြီးပါပြီ။",
        "success",
      );
      setDeletingTransaction(null);
    } catch (error) {
      showAlert(error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (pinValue.length !== 6) return;
    setPinError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinValue }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "PIN အတည်ပြု၍ မရပါ။");
      setShowPinModal(false);
      setPinValue("");
      setMessage("");
      setDataLoadError("");
      await loadDashboard();
      if (deletingTransaction) {
        await deleteTransaction(deletingTransaction);
      }
    } catch (error) {
      setPinError(error.message || "PIN code မှားနေပါသည်။");
      setPinValue("");
    }
  };

  async function createSalesLedger(event) {
    event.preventDefault();
    if (!selectedCustomerId || isSubmitting) {
      if (!selectedCustomerId) {
        showAlert("Customer တစ်ယောက်ကို အရင်ရွေးပါ။", "error");
      }
      return;
    }

    const amount = computedSaleAmount || Number(ledgerForm.amount || 0);

    setIsSubmitting(true);
    try {
      setMessage("");
      
      // Optimistic Update: Calculate and update balance immediately
      const newBalance = (selectedCustomer?.current_balance || 0) + amount;
      setSelectedCustomer(prev => ({
        ...prev,
        current_balance: newBalance,
      }));
      
      // Update customer in list
      setCustomers(prev =>
        prev.map(c => c.id === selectedCustomerId ? { ...c, current_balance: newBalance } : c)
      );

      // Also update allCustomersForKPI to reflect in summary metrics
      setAllCustomersForKPI(prev =>
        prev.map(c => c.id === selectedCustomerId ? { ...c, current_balance: newBalance } : c)
      );
      
      const result = await api(`/api/customers/${selectedCustomerId}/transactions`, {
        method: "POST",
        body: JSON.stringify({
          ...ledgerForm,
          type: "CREDIT",
          amount,
          cartons: Number(ledgerForm.cartons || 0) || null,
          rate: Number(ledgerForm.rate || 0) || null,
          deductions: Number(ledgerForm.deductions || 0),
          date: ledgerForm.date || null,
        }),
      });
      
      // Add new transaction to the list
      if (result && result.ledger) {
        setSelectedCustomer(prev => ({
          ...prev,
          ledgers: [result.ledger, ...(prev.ledgers || [])],
        }));
        
        // Also update the customer in the main list to reflect in "Today's Transactions"
        setCustomers(prev =>
          prev.map(c => 
            c.id === selectedCustomerId 
              ? { ...c, ledgers: [result.ledger, ...(c.ledgers || [])] } 
              : c
          )
        );

        // Also update allCustomersForKPI to reflect in summary metrics
        setAllCustomersForKPI(prev =>
          prev.map(c => 
            c.id === selectedCustomerId 
              ? { ...c, ledgers: [result.ledger, ...(c.ledgers || [])] } 
              : c
          )
        );
      }
      
      setLedgerForm({
        type: "CREDIT",
        saleType: "RETAIL",
        itemSize: "",
        cartons: "",
        rate: "",
        deductions: "",
        amount: "",
        note: "",
        date: "",
        paymentType: "",
      });
      clearDashboardDraftFields(["ledgerForm"]);
      
      showAlert("Sales လက်ခြင်းအောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။", "success");
    } catch (error) {
      setMessage(error.message);
      showAlert(error.message, "error");
      // Revert optimistic update on error
      await loadCustomer(selectedCustomerId);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function matchKpay(event) {
    event.preventDefault();
    if (!matchingKpay || !matchCustomerId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      setMessage("");
      await api("/api/kpay-match", {
        method: "POST",
        body: JSON.stringify({
          unverifiedKpayId: matchingKpay.id,
          customerId: matchCustomerId,
          kpayName: matchingKpay.kpayName,
          amount: matchingKpay.amount,
        }),
      });
      
      const customerId = matchCustomerId;
      const kpayAmount = matchingKpay.amount;
      
      // Optimistic Update: Remove matched KPay from pending list
      setPendingKpay(prev => prev.filter(k => k.id !== matchingKpay.id));
      
      // Update customer balance and ledgers optimistically
      const updateFn = c => 
        c.id === customerId 
          ? { 
              ...c, 
              current_balance: c.current_balance - kpayAmount,
              ledgers: [{
                id: `temp-${Date.now()}`,
                type: 'DEBIT',
                amount: kpayAmount,
                date: new Date().toISOString(),
                note: `KPay Match: ${matchingKpay.kpayName}`
              }, ...(c.ledgers || [])]
            } 
          : c;
      setCustomers(prev => prev.map(updateFn));
      setAllCustomersForKPI(prev => prev.map(updateFn));
      
      setMatchingKpay(null);
      setMatchCustomerId("");
      setSelectedCustomerId(customerId);
      
      showAlert(`KPay ${formatMoney(kpayAmount)} အောင်မြင်စွာ တွဲဆက်ပြီးပါပြီ။`, "success");
    } catch (error) {
      setMessage(error.message);
      showAlert(error.message, "error");
      // Reload data on error
      await Promise.all([loadDashboard(), loadCustomer(matchCustomerId)]);
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditCustomer(customer) {
    setEditingCustomer(customer);
    setEditForm({
      name: customer.name || "",
      phone: customer.phone || "",
      routeTag: customer.routeTag || "",
    });
  }

  async function updateCustomer(event) {
    event.preventDefault();
    if (!editingCustomer || isSubmitting) return;

    setIsSubmitting(true);
    try {
      setMessage("");
      
      // Optimistic Update: Update customer in list immediately
      const updateFn = c => c.id === editingCustomer.id ? { ...c, ...editForm } : c;
      setCustomers(prev => prev.map(updateFn).sort((a, b) => a.name.localeCompare(b.name, 'my')));
      setAllCustomersForKPI(prev => prev.map(updateFn).sort((a, b) => a.name.localeCompare(b.name, 'my')));
      
      const customer = await api(`/api/customers/${editingCustomer.id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      
      setEditingCustomer(null);
      setEditForm({ name: "", phone: "", routeTag: "" });
      clearDashboardDraftFields(["editForm", "editingCustomer"]);
      
      if (selectedCustomerId === customer.id) {
        setSelectedCustomer(prev => ({ ...prev, ...customer }));
      }
      
      showAlert(`Customer "${customer.name}" အောင်မြင်စွာ အဆင့်မြှင့်တင်ပြီးပါပြီ။`, "success");
    } catch (error) {
      setMessage(error.message);
      showAlert(error.message, "error");
      // Revert optimistic update on error
      await loadDashboard();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteCustomer() {
    if (!deletingCustomer || isSubmitting) return;

    setIsSubmitting(true);
    try {
      setMessage("");
      const customerName = deletingCustomer.name;
      
      // Optimistic Update: Remove customer from list immediately
      setCustomers(prev => prev.filter(c => c.id !== deletingCustomer.id));
      setAllCustomersForKPI(prev => prev.filter(c => c.id !== deletingCustomer.id));
      
      await api(`/api/customers/${deletingCustomer.id}`, {
        method: "DELETE",
      });
      
      if (selectedCustomerId === deletingCustomer.id) {
        setSelectedCustomerId(null);
        setSelectedCustomer(null);
      }
      
      setDeletingCustomer(null);
      showAlert(`Customer "${customerName}" ကို အမှိုက်ပုံးထဲသို့ ရွှေ့လိုက်ပါပြီ။`, "success");
      if (showRecycleBin) loadDeletedCustomers();
    } catch (error) {
      setMessage(error.message);
      showAlert(error.message, "error");
      // Revert optimistic update on error
      await loadDashboard();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function restoreCustomer(customer) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api(`/api/customers/${customer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ restore: true }),
      });
      
      setDeletedCustomers(prev => prev.filter(c => c.id !== customer.id));
      setCustomers(prev => [...prev, customer].sort((a, b) => a.name.localeCompare(b.name, 'my')));
      setAllCustomersForKPI(prev => [...prev, customer].sort((a, b) => a.name.localeCompare(b.name, 'my')));
      showAlert(`Customer "${customer.name}" ကို ပြန်လည်ဆယ်ယူပြီးပါပြီ။`, "success");
    } catch (error) {
      showAlert(error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function permanentDeleteCustomer() {
    if (!permanentDeletingCustomer || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api(`/api/customers/${permanentDeletingCustomer.id}?permanent=true`, {
        method: "DELETE",
      });
      
      setDeletedCustomers(prev => prev.filter(c => c.id !== permanentDeletingCustomer.id));
      setPermanentDeletingCustomer(null);
      showAlert(`Customer "${permanentDeletingCustomer.name}" ကို အပြီးတိုင်ဖျက်လိုက်ပါပြီ။`, "success");
    } catch (error) {
      showAlert(error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Export transaction data to CSV
  const exportToCSV = () => {
    const transactionsToExport = filteredLedgers.length > 0 ? filteredLedgers : unifiedTransactions;
    
    if (!selectedCustomer || transactionsToExport.length === 0) {
      showAlert("ထုတ်ယူရန် transaction မရှိပါ။", "error");
      return;
    }

    const headers = ["Date", "Type", "Sale Type", "Amount", "Payment Type", "Note"];
    const rows = transactionsToExport.map(transaction => [
      formatDate(transaction.date),
      transaction.type === "CASH_SALE" ? `လက်ငင်း (${cashSaleTypeLabel(transaction.saleType)})` : transaction.type === "CREDIT" ? "အကြွေးတိုး (Unpaid)" : "ငွေချေ (Paid)",
      transaction.type === "CASH_SALE" ? cashSaleTypeLabel(transaction.saleType) : "-",
      transaction.amount,
      transaction.paymentType || "-",
      transaction.note || "-",
    ]);

    // Create CSV content
    const csvContent = [
      `"Customer: ${selectedCustomer.name}",,,,`,
      `"Phone: ${selectedCustomer.phone || "-"}",,,,`,
      `"Route Tag: ${selectedCustomer.routeTag || "-"}",,,,`,
      `"Current Balance: ${formatMoney(selectedCustomer.current_balance)}",,,,`,
      `"Export Date: ${new Date().toLocaleString('en-GB')}",,,,`,
      ",,,,",
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedCustomer.name}_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert(`"${selectedCustomer.name}" ရဲ့ transaction တွေ အောင်မြင်စွာ ထုတ်ယူပြီးပါပြီ။`, "success");
  };

  const computedSaleAmount = useMemo(() => {
    if (ledgerForm.type !== "CREDIT" || ledgerForm.saleType !== "RETAIL") return null;
    const cartons = Number(ledgerForm.cartons || 0);
    const rate = Number(ledgerForm.rate || 0);
    const deductions = Number(ledgerForm.deductions || 0);
    if (!cartons || !rate) return null;
    return cartons * rate - deductions;
  }, [ledgerForm.cartons, ledgerForm.rate, ledgerForm.deductions, ledgerForm.type, ledgerForm.saleType]);

  // Calculate KPI metrics from the lightweight customer list and today's summary.
  const kpiMetrics = useMemo(() => ({
    todaysTransactionCount: todayPaymentsList.length,
    totalBalance: customers.reduce((sum, customer) => sum + (customer.current_balance || 0), 0),
    totalCustomers: customers.length,
  }), [customers, todayPaymentsList.length]);

  const unifiedTransactions = useMemo(
    () => mergeTransactionsWithCashSales(selectedCustomer?.ledgers || [], selectedCustomer?.cashSales || []),
    [selectedCustomer?.ledgers, selectedCustomer?.cashSales],
  );

  // Handle filter changes from TransactionFilter component
  const handleFilterChange = useCallback((filtered) => {
    setFilteredLedgers(filtered);
  }, []);

  // Reset filtered ledgers when selected customer changes
  useEffect(() => {
    setFilteredLedgers(unifiedTransactions);
  }, [unifiedTransactions]);

  const deletedCustomerLedgers = deletedCustomerDetail?.ledgers || [];
  const deletedCustomerLedgerSummary = deletedCustomerLedgers.reduce(
    (summary, ledger) => {
      const amount = Number(ledger.amount || 0);
      if (ledger.type === "CREDIT") {
        summary.debtCount += 1;
        summary.debtAmount += amount;
      } else {
        summary.paidCount += 1;
        summary.paidAmount += amount;
      }
      return summary;
    },
    { paidCount: 0, paidAmount: 0, debtCount: 0, debtAmount: 0 },
  );

  return (
    <main className="min-h-screen min-w-0 overflow-x-clip bg-transparent" aria-busy={loading || isSubmitting}>
      <OverdueAlertAudio overdueDebts={overdueDebts} ready={overdueDebts !== null} />
      {alert && (
        <AlertNotification message={alert.message} type={alert.type} onClose={hideAlert} />
      )}
      {(loading || isSubmitting) && (
        <div
          className="pwa-top-loading pointer-events-none fixed left-2 z-[100] w-[min(calc(100vw-6.5rem),280px)] rounded-xl border border-cyan-200/80 bg-gradient-to-br from-white/98 via-cyan-50/95 to-white/98 px-2.5 py-2 text-slate-800 shadow-lg shadow-cyan-900/10 backdrop-blur sm:left-5 sm:w-[min(92vw,280px)]"
          role="status"
          aria-live="polite"
          aria-label={isSubmitting ? "လုပ်ဆောင်နေသည်" : "အချက်အလက်များကို ရယူနေသည်"}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-600/10" aria-hidden="true">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-700" />
            </span>
            <p className="min-w-0 truncate text-[11px] font-bold leading-4 text-cyan-900">
              {isSubmitting ? "လုပ်ဆောင်နေပါသည်" : loadingStage || (isLedgerView ? "Customer data ရယူနေပါသည်" : "Data ရယူနေပါသည်")}
            </p>
          </div>
          <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-cyan-100">
            <div className="h-full w-1/3 animate-[pulse_1.4s_ease-in-out_infinite] rounded-full bg-cyan-600" />
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4 overflow-x-clip px-3 py-3 sm:gap-6 sm:px-6 sm:py-6 lg:px-8">
        <header className="neon-surface neon-sweep min-w-0 rounded-2xl border border-cyan-200/80 bg-white/90 px-3 py-3 sm:px-5 sm:py-5">
          {isLedgerView ? (
            <Link href="/" className="text-sm font-medium text-cyan-700">← Dashboard</Link>
          ) : null}
          <div className="grid min-w-0 grid-cols-1 gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(260px,1fr)] lg:items-center lg:gap-x-6">
            <div className="order-2 min-w-0 lg:order-none lg:max-w-[360px] lg:justify-self-start">
              <p className="text-xs text-cyan-600 sm:text-sm">New Life Ledger Dashboard</p>
              <h1 className="mt-1 max-w-full break-words text-[clamp(1rem,4.5vw,1.55rem)] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[clamp(1rem,1.8vw,1.55rem)]">
                Customer ငွေရှင်းတမ်း၊ အကြွေးရှင်းတမ်း
              </h1>
            </div>
            <div className="order-1 min-w-0 text-center lg:order-none lg:min-w-[210px]">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-700">ယနေ့ရက်စွဲ</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{formatMyanmarDateLabel(currentTime)}</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-cyan-700 tabular-nums sm:text-3xl">{formatMyanmarClock(currentTime)}</p>
              <p className="text-[11px] text-slate-500">Myanmar Time (UTC+06:30)</p>
              {!isLedgerView ? (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <label htmlFor="dashboard-kpi-date" className="text-[11px] font-semibold text-cyan-700">KPI ရက်စွဲ</label>
                  <input
                    id="dashboard-kpi-date"
                    type="date"
                    value={selectedKpiDate}
                    onChange={(event) => setSelectedKpiDate(event.target.value)}
                    className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800 shadow-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                    aria-label="KPI ရက်စွဲရွေးရန်"
                  />
                  {kpiDateLoading ? <span className="text-[10px] text-cyan-600">ပြောင်းနေသည်...</span> : null}
                  {kpiDateError ? <span className="text-[10px] text-rose-600">ပြန်စမ်းပါ</span> : null}
                </div>
              ) : null}
            </div>
            <div className="neon-control-deck order-3 grid w-full min-w-0 max-w-none grid-cols-2 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50/90 to-white p-1.5 shadow-sm lg:order-none lg:max-w-[360px] lg:justify-self-end">
              <div className="col-span-2 flex min-w-0 [&>button]:w-full">
                <OverdueNotificationBell
                  compact
                  customers={allCustomersForKPI}
                  overdueDebts={overdueDebts}
                  onSelectCustomer={(id) => {
                    // If clicking the same customer, we still want to trigger the scroll effect
                    if (selectedCustomerId === id) {
                      setShowCustomerList(false);
                      const element = document.getElementById("customer-details-section");
                      if (element) {
                        element.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    } else {
                      setSelectedCustomerId(id);
                    }
                    setSearch(""); // Clear search
                  }}
                />
              </div>

              <Link
                href="/orders"
                className="flex min-h-10 min-w-0 w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-2 text-center text-sm font-semibold leading-4 text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 sm:text-base"
                title="Telegram Orders"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-sm leading-none" aria-hidden="true">📦</span>
                <span>အော်ဒါများ</span>
              </Link>
              <button
                type="button"
                onClick={() => setExpandedDashboardMenu((current) => current === "reports" ? null : "reports")}
                aria-expanded={expandedDashboardMenu === "reports"}
                aria-controls="dashboard-report-menu"
                className="flex min-h-10 min-w-0 w-full items-center justify-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-2 py-2 text-center text-xs font-semibold leading-4 text-violet-700 shadow-sm transition-colors hover:bg-violet-100 sm:text-sm"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-sm leading-none" aria-hidden="true">📊</span>
                <span>အစီရင်ခံ / မှတ်တမ်း</span>
                <span className="shrink-0" aria-hidden="true">{expandedDashboardMenu === "reports" ? "⌃" : "⌄"}</span>
              </button>
              <button
                type="button"
                onClick={() => setExpandedDashboardMenu((current) => current === "data" ? null : "data")}
                aria-expanded={expandedDashboardMenu === "data"}
                aria-controls="dashboard-data-menu"
                className="col-span-2 flex min-h-10 min-w-0 w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-2 py-2 text-center text-xs font-semibold leading-4 text-cyan-700 shadow-sm transition-colors hover:bg-cyan-100 sm:text-sm"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-sm leading-none" aria-hidden="true">🗂️</span>
                <span>ဒေတာ / အမှိုက်ပုံး</span>
                <span className="shrink-0" aria-hidden="true">{expandedDashboardMenu === "data" ? "⌃" : "⌄"}</span>
              </button>

              {expandedDashboardMenu === "reports" ? (
                <div id="dashboard-report-menu" className="col-span-2 grid grid-cols-1 gap-2 rounded-xl border border-violet-200 bg-white p-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={handleOpenTelegramReportPreview}
                    className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
                  >
                    📨 Manual အစီရင်ခံစာ
                  </button>
                  <Link
                    href="/auto-report-status"
                    className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                  >
                    Auto Report အခြေအနေ
                  </Link>
                  <Link
                    href="/vercel-build-logs"
                    className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Build မှတ်တမ်း
                  </Link>
                </div>
              ) : null}

              {expandedDashboardMenu === "data" ? (
                <div id="dashboard-data-menu" className="col-span-2 grid grid-cols-1 gap-2 rounded-xl border border-cyan-200 bg-white p-2 sm:grid-cols-2">
                  <Link
                    href="/data-management"
                    className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-100"
                  >
                    🗂️ ဒေတာစီမံခန့်ခွဲမှု
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowRecycleBin(true)}
                    className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    🗑️ Customer အမှိုက်ပုံး
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {message ? (
            <div className="mt-4 flex flex-col gap-3 rounded-md border border-rose-900 bg-rose-950/60 px-3 py-3 text-sm text-rose-200 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex-1">
                <span>{message}</span>
                {dataLoadError ? (
                  <span className="mt-1 block text-xs text-rose-200/80">
                    {!isOnline
                      ? "အင်တာနက်ပြန်ရလာသောအခါ အလိုအလျောက် ပြန်လည်ရယူပါမည်။"
                      : nextAutoRetrySeconds > 0
                        ? `${nextAutoRetrySeconds} စက္ကန့်အတွင်း အလိုအလျောက် ပြန်စမ်းပါမည်။`
                        : "အချက်အလက်များကို အလိုအလျောက် ပြန်လည်ရယူနေပါသည်။"}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => { setMessage(""); loadDashboard(); }}
                className="shrink-0 rounded-md border border-rose-300/60 px-3 py-2 font-semibold text-rose-100 hover:bg-rose-900/50"
              >
                ပြန်စမ်းမည်
              </button>
            </div>
          ) : null}
        </header>



        {!isLedgerView ? (
          <>
            {/* Compact Summary Box */}
            <section className="neon-surface neon-sweep rounded-2xl border border-cyan-200/80 bg-gradient-to-br from-white/95 via-slate-50/95 to-cyan-50/60 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Total Balance */}
            <Link
              href="/balance-detail"
              aria-label="အသားတင်ရရန်လက်ကျန် အသေးစိတ်ကြည့်ရန်"
              className="neon-card neon-sweep neon-card-rose flex h-full min-h-[110px] min-w-0 w-full flex-col items-start justify-start rounded-xl border border-rose-200 bg-rose-50/85 p-4 text-left shadow-sm transition-shadow hover:border-rose-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-300 sm:min-h-[158px]"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-rose-600">အသားတင်ရရန်လက်ကျန်</p>
              <p className="mt-2 text-2xl font-bold text-rose-700">{loading && !hasKpiSnapshot ? "ရယူနေသည်..." : dataLoadError && !hasKpiSnapshot ? "—" : formatMoney(displayedTotalBalance)}</p>
              <p className="mt-1 text-xs text-rose-500">Net Receivable Balance · အသေးစိတ်ကြည့်ရန် →</p>
            </Link>

            {/* Customer Count */}
            <Link href="/balance-detail" aria-label="Customer Management ဖွင့်ရန်" className="neon-card neon-sweep neon-card-blue flex h-full min-h-[110px] min-w-0 w-full flex-col items-start justify-start rounded-xl border border-blue-200 bg-blue-50/85 p-4 text-left hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-300 sm:min-h-[158px]">
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Customer အရေအတွက်</p>
              <p className="mt-2 text-2xl font-bold text-blue-700">{loading && !hasKpiSnapshot ? "ရယူနေသည်..." : dataLoadError && !hasKpiSnapshot ? "—" : displayedCustomerCount}</p>
              <p className="mt-1 text-xs text-blue-500">Customer Management · အသေးစိတ်ကြည့်ရန် →</p>
            </Link>

            {/* Today&apos;s Transactions */}
            <button
              onClick={() => setShowTodayPaymentsModal(true)}
              disabled={!selectedKpiIsToday}
              className={`neon-card neon-sweep neon-card-emerald flex h-full min-h-[110px] min-w-0 w-full flex-col items-start justify-start rounded-xl border border-emerald-200 bg-emerald-50/85 p-4 text-left shadow-sm transition-all sm:min-h-[158px] ${selectedKpiIsToday ? "cursor-pointer hover:shadow-md hover:border-emerald-300" : "cursor-default"}`}
            >
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">{selectedKpiIsToday ? "ယနေ့" : selectedKpiDate} ငွေချေမှုများ</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{kpiDateLoading || (loading && !hasKpiSnapshot) ? "ရယူနေသည်..." : dataLoadError && !hasKpiSnapshot ? "—" : todayTransactions}</p>
              <p className="mt-1 text-xs text-emerald-500">{selectedKpiIsToday ? "Today&apos;s Paid Transactions" : "ရွေးထားသည့်ရက်စွဲ၏ ငွေချေမှုများ"}</p>
            </button>

            <Link
              href="/daily-summary"
              className="neon-card neon-sweep neon-card-violet flex h-full min-h-[110px] min-w-0 w-full flex-col items-start justify-start rounded-xl border border-violet-200 bg-violet-50/85 p-4 text-left shadow-sm transition-all hover:border-violet-300 hover:shadow-md sm:min-h-[158px]"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-violet-600">နေ့စဉ်စာရင်းချုပ်</p>
              <p className="mt-2 text-lg font-bold text-violet-800">Daily Summary &amp; AI</p>
              <p className="mt-1 text-xs text-violet-600">အသေးစိတ်ကြည့်ရန် →</p>
            </Link>

            <Link
              href="/daily-summary"
              aria-label="ဒီနေ့ လက်ငင်းရောင်း အသေးစိတ်ကြည့်ရန်"
              className="neon-card neon-sweep neon-card-fuchsia flex h-full min-h-[110px] min-w-0 w-full flex-col items-start justify-start rounded-xl border border-fuchsia-200 bg-fuchsia-50/85 p-4 text-left shadow-sm transition-all hover:border-fuchsia-300 hover:shadow-md sm:min-h-[158px]"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-fuchsia-700">{selectedKpiIsToday ? "ဒီနေ့" : selectedKpiDate} လက်ငင်းရောင်း</p>
              <p className="mt-2 text-2xl font-bold text-fuchsia-800">{kpiDateLoading || (loading && !hasKpiSnapshot) ? "ရယူနေသည်..." : dataLoadError && !hasKpiSnapshot ? "—" : formatMoney(todayCashAmount)}</p>
              <p className="mt-1 text-xs text-fuchsia-700">{todayCashCount} ခု · လက်လီ {todayCashRetail} / လက်ကား {todayCashWholesale}</p>
            </Link>

            <DailySalesSummaryPanel />

            <Link
              href="/activity"
              className="neon-card neon-sweep neon-card-amber flex h-full min-h-[110px] min-w-0 w-full flex-col items-start justify-start rounded-xl border border-amber-200 bg-amber-50/85 p-4 text-left shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">လုပ်ဆောင်ချက်မှတ်တမ်း</p>
              <p className="mt-2 text-lg font-bold text-amber-800">Activity History</p>
              <p className="mt-1 text-xs text-amber-700">အသေးစိတ်ကြည့်ရန် →</p>
            </Link>

            <Link
              href="/ledger"
              className="neon-card neon-sweep neon-card-cyan flex h-full min-h-[110px] min-w-0 w-full flex-col items-start justify-start rounded-xl border border-cyan-200 bg-cyan-50/85 p-4 text-left shadow-sm transition-all hover:border-cyan-300 hover:shadow-md"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-cyan-700">Customer စာရင်း</p>
              <p className="mt-2 text-lg font-bold text-cyan-800">ငွေရှင်းတမ်း</p>
              <p className="mt-1 text-xs text-cyan-700">Customer စာရင်းသွင်းရန် →</p>
            </Link>
          </div>
            </section>
          </>
        ) : null}

        {!isLedgerView ? (
          <LedgerPulse data={ledgerPulse} loading={ledgerPulseLoading} error={ledgerPulseError} />
        ) : null}

        {isLedgerView ? (
          <>
            <section className="rounded-lg border border-cyan-500/30 bg-white p-4">
          <button
            className="flex min-h-12 items-center justify-start gap-3 text-left"
            onClick={() => setShowAddCustomer((value) => !value)}
          >
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight text-slate-900">Customer အသစ်ထည့်ရန်</h2>
              <p className="mt-1 text-sm leading-tight text-slate-600">ဖုန်းမှ အမြန်စာရင်းသွင်းရန်</p>
            </div>
            <span className="inline-flex min-h-12 min-w-24 shrink-0 items-center justify-center rounded-lg border border-cyan-300 bg-cyan-50 px-5 py-2 text-base font-semibold text-cyan-700 shadow-sm transition-colors hover:bg-cyan-100">
              {showAddCustomer ? "Hide" : "Add"}
            </span>
          </button>

          {showAddCustomer ? (
            <form className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4" onSubmit={createCustomer}>
              <input
                className="min-h-12 rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-cyan-400"
                placeholder="အမည်"
                value={newCustomer.name}
                onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })}
                required
                disabled={isSubmitting}
              />
              <input
                className="min-h-12 rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-cyan-400"
                inputMode="tel"
                placeholder="ဖုန်းနံပါတ်"
                value={newCustomer.phone}
                onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })}
                disabled={isSubmitting}
              />
              <input
                className="min-h-12 rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-cyan-400"
                inputMode="numeric"
                placeholder="အစ လက်ကျန်အကြွေး"
                value={newCustomer.current_balance}
                onChange={(event) =>
                  setNewCustomer({ ...newCustomer, current_balance: event.target.value })
                }
                disabled={isSubmitting}
              />
              <button 
                className="min-h-12 rounded-md bg-cyan-400 px-5 py-3 text-base font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Adding..." : "Add"}
              </button>
            </form>
          ) : null}
        </section>



        <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-10 text-xs text-slate-900 outline-none transition-all shadow-inner focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 sm:h-12 sm:px-4 sm:pr-12 sm:text-sm"
                placeholder="Customer ရှာရန် (အမည် / ဖုန်း)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <button
                  type="button"
                  aria-label="Customer ရှာဖွေမှု ရှင်းရန်"
                  title="ရှာဖွေမှု ရှင်းရန်"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-base font-semibold leading-none text-slate-500 shadow-sm transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-200 sm:right-3 sm:h-8 sm:w-8"
                >
                  ×
                </button>
              ) : null}
            </div>
            {selectedCustomerId && (
              <button
                onClick={() => setShowCustomerList(!showCustomerList)}
                 className={`shrink-0 rounded-md border px-2 py-2 text-[11px] font-semibold transition-colors whitespace-nowrap sm:px-3 sm:text-sm ${showCustomerList ? "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100" : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
              >
                {showCustomerList ? "Customer စာရင်းဖျောက်မည်" : "Customer စာရင်းပြမည်"}
              </button>
            )}
          </div>
          {showCustomerList && (
          <div className="rounded-xl border border-cyan-100 bg-cyan-50/30 p-2.5 shadow-inner sm:p-3">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <p className="text-xs font-semibold text-cyan-800 sm:text-sm">Customer စာရင်း</p>
              <p className="text-[11px] text-slate-500">အောက်သို့ဆွဲ၍ ရှာရန်</p>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-x-2 bottom-0 z-10 h-5 rounded-b-lg bg-gradient-to-t from-white/90 to-transparent" aria-hidden="true" />
              <div
                aria-label="Customer စာရင်း"
                tabIndex={0}
                className="grid max-h-[600px] grid-cols-2 gap-2 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white p-2 pr-2 shadow-sm md:grid-cols-2 lg:grid-cols-3 customer-list-container animate-slide-up"
              >
            {loading && customers.length === 0 ? (
              <div className="col-span-full rounded-lg border border-slate-200 p-4 text-center text-slate-600">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-400"></div>
                  <span>Customer များ ရှာဖွေနေသည်...</span>
                </div>
              </div>
            ) : dataLoadError && customers.length === 0 ? (
              <div className="col-span-full rounded-lg border border-rose-200 bg-rose-50 p-5 text-center text-sm text-rose-700">
                <p>Customer data မရသေးပါ။ ခဏစောင့်ပြီး ပြန်စမ်းနေပါသည်။</p>
                <p className="mt-1 text-xs text-rose-600">
                  {!isOnline
                    ? "အင်တာနက်ပြန်ရလာသောအခါ အလိုအလျောက် ပြန်လည်ရယူပါမည်။"
                    : nextAutoRetrySeconds > 0
                      ? `${nextAutoRetrySeconds} စက္ကန့်အတွင်း အလိုအလျောက် ပြန်စမ်းပါမည်။`
                      : "အချက်အလက်များကို အလိုအလျောက် ပြန်လည်ရယူနေပါသည်။"}
                </p>
                <button
                  type="button"
                  onClick={() => { setDataLoadError(""); setMessage(""); loadDashboard(); }}
                  className="mt-3 rounded-md border border-rose-300 bg-white px-4 py-2 font-semibold text-rose-700 hover:bg-rose-100"
                >
                  ပြန်စမ်းမည်
                </button>
              </div>
            ) : customers.length ? (
              paginatedCustomers.map((customer) => (
                <div
                  key={`customer-${customer.id}`}
                  className={`cursor-pointer rounded-lg border p-2 sm:p-3 lg:p-4 customer-card ${
                    highlightedCustomerId === customer.id
                      ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/40 shadow-lg"
                      : selectedCustomerId === customer.id
                      ? "border-cyan-500 bg-cyan-500/5 ring-1 ring-cyan-500/20"
                      : "border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50/60"
                  }`}
                  onClick={() => {
                    setSelectedCustomerId(customer.id);
                    setHighlightedCustomerId(customer.id);
                    // Delay hiding the list to allow animation
                    setTimeout(() => {
                      setShowCustomerList(false);
                      setHighlightedCustomerId(null);
                    }, 400);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="truncate font-bold text-slate-900 text-xs hover:text-cyan-600 transition-colors sm:text-sm">{customer.name}</h3>
                      <p className="truncate text-[10px] text-slate-600 sm:text-[11px]">
                        {[customer.phone, customer.routeTag].filter(Boolean).join(" / ") || "ဆက်သွယ်ရန်အချက်အလက်မရှိ"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200/50 flex items-center justify-between gap-1">
                    <p className="truncate text-[10px] text-slate-700 font-medium sm:text-xs">{getBalanceLabel(customer.current_balance)}</p>
                    <p
                      className={`shrink-0 text-xs font-semibold sm:text-sm ${
                        customer.current_balance > 0
                          ? "text-rose-700"
                          : customer.current_balance < 0
                            ? "text-emerald-700"
                            : "text-slate-700"
                      }`}
                    >
                      {formatBalanceAmount(customer.current_balance)}
                    </p>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      className="flex min-h-8 flex-1 items-center justify-center rounded-md px-1 py-1.5 text-[10px] font-medium text-cyan-700 hover:bg-cyan-50 sm:min-h-9 sm:text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditCustomer(customer);
                      }}
                      disabled={isSubmitting}
                    >
                      ပြင်ရန်
                    </button>
                    <button
                      className="flex min-h-8 flex-1 items-center justify-center rounded-md px-1 py-1.5 text-[10px] font-medium text-rose-600 hover:bg-rose-50 sm:min-h-9 sm:text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingCustomer(customer);
                      }}
                      disabled={isSubmitting}
                    >
                      ဖျက်ရန်
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
                Customer မရှိသေးပါ။
              </p>
            )}
              </div>
            </div>
          </div>

          )}
          {customers.length > 0 && totalPages > 1 && showCustomerList && (
            <div className="mt-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <div className="text-sm text-slate-600">
                <span className="font-medium text-slate-700">{customers.length}</span> ယောက် • စာမျက်နှာ <span className="font-medium text-slate-700">{currentPage}</span> / <span className="font-medium text-slate-700">{totalPages}</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-cyan-400 hover:text-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ယခင်
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      className={`min-w-10 rounded-md px-2 py-2 text-sm font-medium ${
                        currentPage === page
                          ? "bg-cyan-400 text-slate-950"
                          : "border border-slate-300 text-slate-700 hover:border-cyan-400 hover:text-cyan-600"
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-cyan-400 hover:text-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  နောက်
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 min-h-[500px]">
            {loadingCustomer ? (
              <div className="flex min-h-[460px] items-center justify-center rounded-lg border border-dashed border-slate-300">
                <div className="text-center">
                  <div className="flex justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-600 border-t-cyan-400"></div>
                  </div>
                  <p className="mt-4 text-slate-600">Customer အချက်အလက် ရယူနေသည်...</p>
                </div>
              </div>
            ) : selectedCustomer ? (
              <div id="customer-details-section" className="scroll-mt-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pt-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{selectedCustomer.name}</h2>
                    <p className="mt-1 text-sm text-slate-700">
                      {[selectedCustomer.phone, selectedCustomer.routeTag].filter(Boolean).join(" / ") ||
                        "ဖုန်းနံပါတ်မရှိ"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-700 font-medium">{getBalanceLabel(selectedCustomer.current_balance)}</p>
                    <p
                      className={`text-2xl font-bold sm:text-3xl ${
                        selectedCustomer.current_balance > 0
                          ? "text-rose-700"
                          : selectedCustomer.current_balance < 0
                            ? "text-emerald-700"
                            : "text-slate-700"
                      }`}
                    >
                      {formatBalanceAmount(selectedCustomer.current_balance)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 items-start">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-3 shadow-sm sm:p-5">
                    <h3 className="text-lg font-semibold text-slate-900">စာရင်းအသစ်သွင်းရန်</h3>
                    <form className="mt-3 space-y-3" onSubmit={createLedgerTransaction}>
                      <div className="flex flex-wrap p-1 bg-slate-50/80 rounded-xl border border-slate-200 mb-3 shadow-inner">
                        <button
                          type="button"
                          className={`flex-1 min-w-[30%] py-2 text-sm font-semibold rounded-md transition-all ${
                            ledgerForm.type === "CREDIT"
                              ? "bg-rose-600 text-slate-900 shadow-lg"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                          onClick={() => setLedgerForm({ ...ledgerForm, type: "CREDIT" })}
                          disabled={isSubmitting}
                        >
                          အကြွေးတိုး
                        </button>
                        <button
                          type="button"
                          className={`flex-1 min-w-[30%] py-2 text-sm font-semibold rounded-md transition-all ${
                            ledgerForm.type === "DEBIT"
                              ? "bg-emerald-600 text-slate-900 shadow-lg"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                          onClick={() => setLedgerForm({ ...ledgerForm, type: "DEBIT" })}
                          disabled={isSubmitting}
                        >
                          ငွေချေ
                        </button>
                        <button
                          type="button"
                          className={`flex-1 min-w-[30%] py-2 text-sm font-semibold rounded-md transition-all ${
                            ledgerForm.type === "CASH_SALE"
                              ? "bg-cyan-500 text-slate-950 shadow-lg"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                          onClick={() => setLedgerForm({ ...ledgerForm, type: "CASH_SALE", paymentType: ledgerForm.paymentType || "CASH" })}
                          disabled={isSubmitting}
                        >
                          လက်ငင်းရောင်း
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 ml-1">ရက်စွဲ</label>
                          <div className="relative">
                            <input
                              type="date"
                              className="w-full h-12 rounded-lg border border-slate-300 bg-slate-50/50 px-4 text-sm text-slate-900 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all appearance-none"
                              style={{ colorScheme: 'dark' }}
                              value={ledgerForm.date}
                              onChange={(e) => setLedgerForm({ ...ledgerForm, date: e.target.value })}
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 ml-1">ပမာဏ (Ks)</label>
                          <input
                            type="number"
                            className="w-full h-12 rounded-lg border border-slate-300 bg-slate-50/50 px-4 text-sm text-slate-900 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                            placeholder="0"
                            value={ledgerForm.amount}
                            onChange={(e) => setLedgerForm({ ...ledgerForm, amount: e.target.value })}
                            required
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>

                      {ledgerForm.type === "CASH_SALE" && (
                        <div className="space-y-1">
                          <label className="text-xs text-slate-700 font-medium">လက်ငင်းရောင်းအမျိုးအစား</label>
                          <div className="grid grid-cols-2 gap-2 rounded-lg border border-cyan-200 bg-cyan-50/60 p-1">
                            <button
                              type="button"
                              className={`min-h-10 rounded-md px-3 py-2 text-sm font-semibold transition-all ${ledgerForm.saleType === "RETAIL" ? "bg-cyan-600 text-white shadow-sm" : "text-cyan-800 hover:bg-cyan-100"}`}
                              onClick={() => setLedgerForm({ ...ledgerForm, saleType: "RETAIL" })}
                              disabled={isSubmitting}
                            >
                              လက်လီ
                            </button>
                            <button
                              type="button"
                              className={`min-h-10 rounded-md px-3 py-2 text-sm font-semibold transition-all ${ledgerForm.saleType === "WHOLESALE" ? "bg-cyan-600 text-white shadow-sm" : "text-cyan-800 hover:bg-cyan-100"}`}
                              onClick={() => setLedgerForm({ ...ledgerForm, saleType: "WHOLESALE" })}
                              disabled={isSubmitting}
                            >
                              လက်ကား
                            </button>
                          </div>
                        </div>
                      )}

                      {(ledgerForm.type === "DEBIT" || ledgerForm.type === "CASH_SALE") && (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs text-slate-700 font-medium">{ledgerForm.type === "CASH_SALE" ? "လက်ငင်းငွေပေးချေမှုပုံစံ" : "ငွေပေးချေမှုပုံစံ"}</label>
                            <select
                              className="w-full h-12 rounded-lg border border-slate-300 bg-slate-50/50 px-4 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                              value={ledgerForm.paymentType}
                              onChange={(e) => setLedgerForm({ ...ledgerForm, paymentType: e.target.value })}
                              disabled={isSubmitting}
                            >
                              <option value="">Select Payment Type</option>
                              <option value="CASH">Cash</option>
                              <option value="KPAY">KPay</option>
                              <option value="BANK">Bank Transfer</option>
                              <option value="WAVE">Wave Money</option>
                            </select>
                          </div>
                          {ledgerForm.type === "CASH_SALE" && (
                            <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 p-3">
                              <p className="text-xs font-semibold text-cyan-900">Payment ခွဲထည့်ရန် (မရောအောင်)</p>
                              <p className="mt-1 text-[11px] leading-4 text-cyan-800">စုစုပေါင်းပမာဏနှင့် Cash/KPay/Bank/Wave/Special ပေါင်းလဒ် တူရပါမယ်။</p>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                {[['CASH', 'Cash'], ['KPAY', 'KPay'], ['BANK', 'Bank'], ['WAVE', 'Wave'], ['SPECIAL', 'Special']].map(([key, label]) => (
                                  <label key={key} className="space-y-1">
                                    <span className="text-[11px] font-semibold text-cyan-900">{label} (Ks)</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={ledgerForm.paymentBreakdown?.[key] || ""}
                                      onChange={(e) => setLedgerForm({ ...ledgerForm, paymentBreakdown: { ...(ledgerForm.paymentBreakdown || {}), [key]: e.target.value } })}
                                      className="h-10 w-full rounded-md border border-cyan-200 bg-white px-2.5 text-sm text-slate-900"
                                      disabled={isSubmitting}
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <textarea
                        className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                        placeholder="မှတ်စု (Note)"
                        rows="2"
                        value={ledgerForm.note}
                        onChange={(e) => setLedgerForm({ ...ledgerForm, note: e.target.value })}
                        disabled={isSubmitting}
                      ></textarea>

                      <button 
                        className="w-full min-h-11 rounded-md bg-cyan-400 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed sm:min-h-12 sm:py-3"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "သိမ်းဆည်းနေသည်..." : "စာရင်းသိမ်းမည်"}
                      </button>
                    </form>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">စာရင်းမှတ်တမ်း (Transactions)</h3>
                  </div>
                  
                  <TransactionFilter 
                    transactions={unifiedTransactions}
                    onFilterChange={handleFilterChange}
                  />

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      className="min-h-10 w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-emerald-500 sm:w-auto"
                      onClick={exportToCSV}
                    >
                      ဒီ Customer ၏ စာရင်း Export (CSV)
                    </button>
                  </div>

                  <div className="mt-3 space-y-2 md:hidden">{filteredLedgers.length ? filteredLedgers.map((ledger) => (
                    <article key={`mobile-${ledger.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0"><p className="text-[10px] text-slate-500">Date</p><p className="mt-0.5 truncate text-xs font-medium text-slate-800">{formatDate(ledger.date)}</p></div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ledger.type === "CASH_SALE" ? (ledger.saleType === "RETAIL" ? "bg-violet-100 text-violet-800 ring-1 ring-violet-200" : "bg-amber-100 text-amber-800 ring-1 ring-amber-200") : ledger.type === "CREDIT" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{ledger.type === "CASH_SALE" ? `လက်ငင်း · ${cashSaleTypeLabel(ledger.saleType)}` : ledger.type === "CREDIT" ? "အကြွေးတိုး" : "ငွေချေ"}</span>
                      </div>
                      <p className={`mt-1.5 text-lg font-bold leading-tight ${ledger.type === "CASH_SALE" ? "text-cyan-600" : ledger.type === "CREDIT" ? "text-rose-600" : "text-emerald-600"}`}>{formatMoney(ledger.amount)}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-[11px]">
                        <div className="min-w-0"><p className="text-[10px] text-slate-500">Payment</p><p className="mt-0.5 truncate font-medium text-slate-700">{ledger.type === "CASH_SALE" ? `${ledger.paymentType || "CASH"} · ${cashSaleTypeLabel(ledger.saleType)}` : ledger.paymentType || "-"}</p></div>
                        <div className="min-w-0"><p className="text-[10px] text-slate-500">Note</p><p className="mt-0.5 truncate font-medium text-slate-700">{ledger.note || "-"}</p></div>
                      </div>
                      <button type="button" onClick={() => setDeletingTransaction(ledger)} className="mt-2 min-h-8 w-full rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">ဖျက်ရန်</button>
                    </article>
                  )) : <div className="rounded-lg border border-slate-200 px-3 py-6 text-center text-sm text-slate-500">Transaction မရှိသေးပါ။</div>}</div>

                  <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-100 text-xs uppercase text-slate-700">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3">Payment</th>
                          <th className="px-4 py-3">Note</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredLedgers.length ? (
                          filteredLedgers.map((ledger) => (
                            <tr key={ledger.id} className="hover:bg-slate-50/50 group">
                              <td className="whitespace-nowrap px-4 py-3 text-xs">
                                {formatDate(ledger.date)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                    ledger.type === "CASH_SALE"
                                      ? (ledger.saleType === "RETAIL" ? "bg-violet-100 text-violet-800 ring-1 ring-violet-200" : "bg-amber-100 text-amber-800 ring-1 ring-amber-200")
                                      : ledger.type === "CREDIT"
                                        ? "bg-rose-100 text-rose-700"
                                        : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {ledger.type === "CASH_SALE" ? `လက်ငင်း · ${cashSaleTypeLabel(ledger.saleType)}` : ledger.type === "CREDIT" ? "အကြွေးတိုး" : "ငွေချေ"}
                                </span>
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-medium ${
                                  ledger.type === "CASH_SALE" ? "text-cyan-600" : ledger.type === "CREDIT" ? "text-rose-600" : "text-emerald-600"
                                }`}
                              >
                                {formatMoney(ledger.amount)}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600">
                                {ledger.paymentType || "-"}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate">
                                {ledger.note || "-"}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setDeletingTransaction(ledger)}
                                  className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                  title={ledger.type === "CASH_SALE" ? "Delete cash sale" : "Delete transaction"}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                              Transaction မရှိသေးပါ။
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-col items-center gap-2 text-sm text-slate-600">
                    <span>{unifiedTransactions.length} / {transactionPagination.total + (selectedCustomer.cashSales?.length || 0)} transactions loaded</span>
                    {transactionPagination.hasMore && (
                      <button
                        type="button"
                        onClick={loadMoreTransactions}
                        disabled={loadingMoreTransactions}
                        className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {loadingMoreTransactions ? "Loading..." : "နောက်ထပ် ၅၀ ခုကြည့်ရန်"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/50">
                <div className="text-center">
                  <p className="text-lg font-medium text-slate-500">Customer တစ်ယောက်ကို ရွေးချယ်ပါ</p>
                  <p className="mt-1 text-sm text-slate-600">အချက်အလက်များ ကြည့်ရှုရန်နှင့် စာရင်းသွင်းရန်</p>
                </div>
              </div>
            )}
          </div>
          </section>
          </>
        ) : null}
      </div>

      {/* Recycle Bin Modal */}
      {showRecycleBin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 sm:p-5">
              <h3 className="text-xl font-semibold text-slate-900">🗑️ Recycle Bin (ဖျက်ထားသော Customer များ)</h3>
              <button
                onClick={() => setShowRecycleBin(false)}
                className="rounded-full p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {loadingDeleted ? (
                <div className="flex justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-600 border-t-cyan-400"></div>
                </div>
              ) : deletedCustomers.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {deletedCustomers.map((customer) => (
                    <div key={customer.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-slate-900">{customer.name}</h4>
                          <p className="text-xs text-slate-700">{customer.phone || "No phone"}</p>
                          <p className="mt-2 text-xs text-rose-600 font-medium">
                            Deleted on: {formatDate(customer.deletedAt)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => restoreCustomer(customer)}
                            className="rounded-md bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-600/30"
                            disabled={isSubmitting}
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => setPermanentDeletingCustomer(customer)}
                            className="rounded-md bg-rose-600/20 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-600/30"
                            disabled={isSubmitting}
                          >
                            Delete Forever
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <button
                          type="button"
                          onClick={() => openDeletedCustomerDetail(customer)}
                          className="min-h-10 w-full rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-100"
                        >
                          အသေးစိတ်ကြည့်ရန်
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-slate-500">
                  အမှိုက်ပုံးထဲတွင် ဘာမှမရှိပါ။
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 p-4 text-right">
              <button
                onClick={() => setShowRecycleBin(false)}
                className="rounded-md bg-slate-200 px-5 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deletedCustomerDetail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-cyan-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-50 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-cyan-700">Customer အသေးစိတ်</p>
                <h3 className="mt-1 truncate text-xl font-semibold text-slate-900">{deletedCustomerDetail.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeletedCustomerDetail(null);
                  setDeletedCustomerDetailError("");
                }}
                className="rounded-full p-2 text-slate-600 hover:bg-white hover:text-slate-900"
                aria-label="အသေးစိတ်ပိတ်ရန်"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
              {loadingDeletedCustomerDetail ? (
                <div className="flex min-h-52 items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-600" />
                    <p className="mt-3 text-sm text-slate-600">Customer အသေးစိတ် ရယူနေသည်...</p>
                  </div>
                </div>
              ) : deletedCustomerDetailError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p className="font-semibold">အသေးစိတ် ရယူ၍ မရပါ</p>
                  <p className="mt-1">{deletedCustomerDetailError}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <h4 className="font-semibold text-slate-900">Customer အချက်အလက်</h4>
                    <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div><p className="text-xs text-slate-500">Customer အမည်</p><p className="mt-1 font-medium text-slate-900">{deletedCustomerDetail.name}</p></div>
                      <div><p className="text-xs text-slate-500">ဖုန်းနံပါတ်</p><p className="mt-1 font-medium text-slate-900">{deletedCustomerDetail.phone || "မရှိပါ"}</p></div>
                      <div><p className="text-xs text-slate-500">လမ်းကြောင်း</p><p className="mt-1 font-medium text-slate-900">{deletedCustomerDetail.routeTag || "မသတ်မှတ်ရသေးပါ"}</p></div>
                      <div><p className="text-xs text-slate-500">ဖျက်ထားသည့်အချိန်</p><p className="mt-1 font-medium text-rose-700">{deletedCustomerDetail.deletedAt ? formatDate(deletedCustomerDetail.deletedAt) : "မသိရသေးပါ"}</p></div>
                      <div><p className="text-xs text-slate-500">စတင်ထည့်ထားသည့်အချိန်</p><p className="mt-1 font-medium text-slate-900">{deletedCustomerDetail.createdAt ? formatDate(deletedCustomerDetail.createdAt) : "မသိရသေးပါ"}</p></div>
                      <div><p className="text-xs text-slate-500">လက်ရှိလက်ကျန်</p><p className="mt-1 font-medium text-slate-900">{getBalanceLabel(deletedCustomerDetail.current_balance)} — {formatBalanceAmount(deletedCustomerDetail.current_balance)}</p></div>
                    </div>
                    <div className="mt-4 border-t border-slate-200 pt-3">
                      <p className="text-xs text-slate-500">KPay အမည်များ</p>
                      {deletedCustomerDetail.kpayAliases?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {deletedCustomerDetail.kpayAliases.map((alias) => <span key={alias.id} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">{alias.kpayName}</span>)}
                        </div>
                      ) : <p className="mt-1 text-sm text-slate-600">KPay ချိတ်ဆက်ထားခြင်း မရှိပါ။</p>}
                    </div>
                  </section>

                  <section>
                    <h4 className="font-semibold text-slate-900">ငွေစာရင်းအနှစ်ချုပ်</h4>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs text-emerald-700">ငွေချေ</p><p className="mt-1 text-lg font-bold text-emerald-800">{deletedCustomerLedgerSummary.paidCount} ခု</p><p className="text-xs text-emerald-700">{formatMoney(deletedCustomerLedgerSummary.paidAmount)}</p></div>
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3"><p className="text-xs text-rose-700">အကြွေးတိုး</p><p className="mt-1 text-lg font-bold text-rose-800">{deletedCustomerLedgerSummary.debtCount} ခု</p><p className="text-xs text-rose-700">{formatMoney(deletedCustomerLedgerSummary.debtAmount)}</p></div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="text-xs text-blue-700">စာရင်းစုစုပေါင်း</p><p className="mt-1 text-lg font-bold text-blue-800">{deletedCustomerLedgers.length} ခု</p></div>
                      <div className="rounded-lg border border-violet-200 bg-violet-50 p-3"><p className="text-xs text-violet-700">ပြသထားသည့်စာရင်း</p><p className="mt-1 text-lg font-bold text-violet-800">နောက်ဆုံး ၅၀</p></div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <h4 className="font-semibold text-slate-900">ငွေချေ / အကြွေးတိုး အသေးစိတ်</h4>
                      <p className="mt-1 text-xs text-slate-500">နောက်ဆုံး ၅၀ စာရင်းကို ရက်စွဲအလိုက် ပြထားပါသည်။</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {deletedCustomerLedgers.length ? deletedCustomerLedgers.map((ledger) => (
                        <article key={ledger.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0"><p className="text-xs text-slate-500">{formatDate(ledger.date)}</p><p className="mt-1 text-sm font-medium text-slate-800">{ledger.type === "CREDIT" ? "အကြွေးတိုး" : "ငွေချေ"} {ledger.saleType ? `(${ledger.saleType})` : ""}</p></div>
                            <p className={`shrink-0 text-base font-bold ${ledger.type === "CREDIT" ? "text-rose-700" : "text-emerald-700"}`}>{formatMoney(ledger.amount)}</p>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                            <div><span className="text-slate-500">ငွေပေးချေမှုအမျိုးအစား — </span><span className="font-medium text-slate-700">{ledger.paymentType || "မသတ်မှတ်ရသေးပါ"}</span></div>
                            <div><span className="text-slate-500">မှတ်ချက် — </span><span className="font-medium text-slate-700">{ledger.note || "မရှိပါ"}</span></div>
                          </div>
                        </article>
                      )) : <p className="px-4 py-8 text-center text-sm text-slate-500">ငွေစာရင်း မရှိသေးပါ။</p>}
                    </div>
                  </section>
                </div>
              )}
            </div>
            <div className="flex shrink-0 justify-end border-t border-cyan-200 bg-cyan-50/50 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => {
                  setDeletedCustomerDetail(null);
                  setDeletedCustomerDetailError("");
                }}
                className="min-h-10 rounded-md bg-slate-200 px-5 py-2 text-sm font-medium text-slate-900 hover:bg-slate-300"
              >
                ပိတ်မည်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">Edit Customer</h3>
            <form className="mt-6 space-y-4" onSubmit={updateCustomer}>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 font-medium">Customer Name</label>
                <input
                  className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all shadow-inner"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 font-medium">Phone Number</label>
                <input
                  className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all shadow-inner"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-700 font-medium">Route / Tag</label>
                <input
                  className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all shadow-inner"
                  value={editForm.routeTag}
                  onChange={(e) => setEditForm({ ...editForm, routeTag: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-md bg-slate-200 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                  onClick={() => { setEditingCustomer(null); setEditForm({ name: "", phone: "", routeTag: "" }); }}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  className="flex-1 rounded-md bg-cyan-400 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Updating..." : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Delete Confirmation Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-500">
              🗑️
            </div>
            <h3 className="mt-4 text-xl font-semibold text-slate-900">Delete Customer?</h3>
            <p className="mt-2 text-slate-600">
              &quot;{deletingCustomer.name}&quot; ကို ဖျက်ရန် သေချာပါသလား? ဖျက်လိုက်သော Customer များကို Recycle Bin ထဲတွင် ပြန်လည်ရှာဖွေနိုင်ပါသည်။
            </p>
            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-md bg-slate-200 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                onClick={() => setDeletingCustomer(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-md bg-rose-600 py-3 text-sm font-semibold text-slate-900 hover:bg-rose-500 disabled:opacity-50"
                onClick={deleteCustomer}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Deleting..." : "Move to Bin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Today's Payments Modal */}
      {showTodayPaymentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-emerald-200 bg-white shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="border-b border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/50 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-emerald-900">ယနေ့ ငွေချေမှုများ</h3>
                <p className="mt-1 text-sm text-emerald-700">Today&apos;s Paid Transactions</p>
              </div>
              <button
                onClick={() => setShowTodayPaymentsModal(false)}
                className="text-emerald-600 hover:text-emerald-900 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-6">
              {todayPaymentsList.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                  {todayPaymentsList.map((payment) => (
                    <div
                      key={`payment-${payment.id}`}
                      className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-50/50 p-4 hover:shadow-md hover:border-emerald-300 transition-all"
                    >
                      {/* Customer Name */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 text-sm">{payment.customerName}</h4>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {payment.customerPhone || "No phone"}
                          </p>
                        </div>
                        {payment.paymentType === "KPay" && (
                          <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded">
                            KPay
                          </span>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="border-t border-emerald-200/50 pt-3">
                        <p className="text-xs text-emerald-600 font-medium mb-1">ပေးချေငွေပမာဏ</p>
                        <p className="text-lg font-bold text-emerald-700">{formatMoney(payment.amount)}</p>
                      </div>

                      {/* Date and Note */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">ရက်စွဲ</span>
                          <span className="font-medium text-slate-900">{formatDate(payment.date)}</span>
                        </div>
                        {payment.note && (
                          <div className="bg-white/50 rounded px-2 py-1.5 text-xs text-slate-700 border border-emerald-100">
                            <span className="text-slate-600 block text-xs mb-0.5">မှတ်ချက်</span>
                            {payment.note}
                          </div>
                        )}
                      </div>

                      {/* Sale Details if available */}
                      {(payment.saleType || payment.cartons || payment.rate) && (
                        <div className="mt-3 pt-3 border-t border-emerald-200/50 text-xs space-y-1">
                          {payment.saleType && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">အမျိုးအစား:</span>
                              <span className="font-medium text-slate-900">{payment.saleType}</span>
                            </div>
                          )}
                          {payment.cartons && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">Cartons:</span>
                              <span className="font-medium text-slate-900">{payment.cartons}</span>
                            </div>
                          )}
                          {payment.rate && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">Rate:</span>
                              <span className="font-medium text-slate-900">{formatMoney(payment.rate)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-slate-600 font-medium">ယနေ့ ငွေချေမှုမရှိသေးပါ</p>
                  <p className="text-sm text-slate-500 mt-1">No payments recorded today</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-emerald-200 bg-emerald-50/50 px-6 py-4 text-right">
              <button
                onClick={() => setShowTodayPaymentsModal(false)}
                className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Telegram Report Preview and PIN Modal */}
      {showTelegramReportModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-md sm:p-4">
          <div className="flex min-h-[100dvh] items-start justify-center overflow-y-auto px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:min-h-full sm:items-center sm:py-0">
            <div className="my-0 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-2xl sm:my-8 sm:max-h-[calc(100vh-4rem)]">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
                <div className="mb-5 text-center">
              <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-2xl">📨</div>
              <h3 className="text-xl font-bold text-slate-900">ငွေရှင်းတမ်း ပို့ရန်</h3>
              <p className="mt-2 text-sm text-slate-600">အရင်ဆုံး report date နဲ့ အခြေအနေကို စစ်ဆေးပါ။</p>
            </div>

            {telegramReportStep === "preview" ? (
              <>
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="telegram-report-date">Report date ရွေးပါ</label>
                  <input
                    id="telegram-report-date"
                    type="date"
                    value={telegramReportDate}
                    max={getPreviousMyanmarDateInputValue(currentTime)}
                    onChange={handleTelegramReportDateChange}
                    disabled={isLoadingTelegramReportPreview || isSendingTelegramReport}
                    className="mt-2 block min-w-0 w-full max-w-full box-border appearance-none rounded-xl border border-violet-300 bg-white px-3 py-3 text-center text-base font-semibold leading-normal text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:bg-slate-100 sm:px-4 sm:text-lg"
                  />
                  <p className="mt-2 text-xs text-slate-500">ရွေးထားတဲ့နေ့အတွက် Daily Summary နဲ့ Activity History ကို preview ပြပြီး၊ အဲ့ဒီနေ့ report ကိုပဲ Telegram သို့ ပို့ပါမယ်။</p>
                </div>
                {isLoadingTelegramReportPreview ? (
                  <div className="rounded-xl border border-violet-100 bg-violet-50 p-6 text-center text-sm text-violet-700">
                    {telegramReportDate || "ရွေးထားသောနေ့"} report အချက်အလက်များ ရယူနေသည်...
                  </div>
                ) : telegramReportError && !telegramReportPreview ? (
                  <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <p>{telegramReportError}</p>
                    <button
                      type="button"
                      onClick={() => loadTelegramReportPreview(telegramReportDate)}
                      className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      ပြန်စမ်းမည်
                    </button>
                  </div>
                ) : telegramReportPreview ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">REPORT DATE</p>
                      <p className="mt-1 text-2xl font-bold text-violet-900">{telegramReportPreview.date}</p>
                      <p className="mt-1 text-xs text-violet-700">{telegramReportPreview.period}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs text-emerald-700">ငွေချေ</p>
                        <p className="mt-1 text-lg font-bold text-emerald-800">{telegramReportPreview.summary.paidCount} ခု</p>
                        <p className="text-xs text-emerald-700">{formatMoney(telegramReportPreview.summary.paidAmount)}</p>
                      </div>
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                        <p className="text-xs text-rose-700">အကြွေးတိုး</p>
                        <p className="mt-1 text-lg font-bold text-rose-800">{telegramReportPreview.summary.debtCount} ခု</p>
                        <p className="text-xs text-rose-700">{formatMoney(telegramReportPreview.summary.debtAmount)}</p>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <p className="text-xs text-blue-700">Transactions</p>
                        <p className="mt-1 text-lg font-bold text-blue-800">{telegramReportPreview.summary.totalTransactions} ခု</p>
                      </div>
                      <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                        <p className="text-xs text-purple-700">လုပ်ဆောင်ချက်မှတ်တမ်း</p>
                        <p className="mt-1 text-lg font-bold text-purple-800">{telegramReportPreview.summary.activityCount ?? telegramReportPreview.summary.auditCount} ခု</p>
                      </div>
                    </div>
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      ဒီအချက်အလက်များမှန်ကန်ကြောင်း စစ်ပြီးမှ PIN ထည့်ကာ Telegram group သို့ ပို့ပါမည်။
                    </p>
                  </div>
                ) : null}
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                    onClick={resetTelegramReportModal}
                    disabled={false}
                  >
                    မပို့တော့ပါ
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:bg-slate-400"
                    onClick={handleProceedToTelegramPin}
                    disabled={!telegramReportPreview || isLoadingTelegramReportPreview}
                  >
                    အချက်အလက်မှန်ပါသည်
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleManualTelegramReport}>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <p className="text-sm font-semibold text-emerald-800">{telegramReportPreview?.date} report ကို ပို့မည်</p>
                  <p className="mt-1 text-xs text-emerald-700">ငွေချေ {telegramReportPreview?.summary.paidCount} ခု • အကြွေးတိုး {telegramReportPreview?.summary.debtCount} ခု • လုပ်ဆောင်ချက် {telegramReportPreview?.summary.activityCount ?? telegramReportPreview?.summary.auditCount} ခု</p>
                </div>
                <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="telegram-report-pin">PIN code</label>
                <input
                  id="telegram-report-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={telegramReportPin}
                  onChange={(event) => {
                    setTelegramReportPin(event.target.value);
                    setTelegramReportError("");
                  }}
                  placeholder="PIN code ထည့်ပါ"
                  className="mt-2 w-full rounded-xl border border-violet-300 px-4 py-3 text-center text-lg tracking-[0.35em] outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  disabled={isSendingTelegramReport}
                  autoFocus
                />
                {telegramReportError ? (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{telegramReportError}</p>
                ) : null}
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                    onClick={() => {
                      setTelegramReportStep("preview");
                      setTelegramReportPin("");
                      setTelegramReportError("");
                    }}
                    disabled={isSendingTelegramReport}
                  >
                    နောက်သို့
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:bg-slate-400"
                    disabled={!telegramReportPin.trim() || isSendingTelegramReport}
                  >
                    {isSendingTelegramReport ? "ပို့နေသည်..." : "Telegram သို့ ပို့မည်"}
                  </button>
                </div>
              </form>
            )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Delete Confirmation Modal */}
      {deletingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-slate-900">Transaction ဖျက်မှာ သေချာပါသလား?</h3>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm border border-slate-100">
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Date:</span>
                <span className="font-medium text-slate-700">{formatDate(deletingTransaction.date)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Type:</span>
                <span className={`font-medium ${deletingTransaction.type === 'CASH_SALE' ? 'text-cyan-600' : deletingTransaction.type === 'CREDIT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {deletingTransaction.type === 'CASH_SALE' ? 'လက်ငင်း' : deletingTransaction.type === 'CREDIT' ? 'အကြွေးတိုး' : 'ငွေချေ'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-bold text-slate-900">{formatMoney(deletingTransaction.amount)}</span>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              ဤလုပ်ဆောင်ချက်ကို ပြန်ပြင်၍မရပါ။ {deletingTransaction.type === 'CASH_SALE' ? 'လက်ငင်းမှတ်တမ်းကိုသာ ဖျက်ပြီး Customer လက်ကျန် မပြောင်းပါ။' : 'စာရင်းဇယားများ ပြန်လည်ချိန်ညှိသွားပါမည်။'}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-md bg-slate-100 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition-colors"
                onClick={() => setDeletingTransaction(null)}
                disabled={isSubmitting}
              >
                မဖျက်တော့ပါ
              </button>
              <button
                className="flex-1 rounded-md bg-rose-600 py-3 text-sm font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
                onClick={() => setShowPinModal(true)}
                disabled={isSubmitting}
              >
                ဆက်လုပ်မည်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Verification Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl border border-slate-200">
            <div className="text-center mb-8">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-cyan-50 text-cyan-600 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900">PIN Code လိုအပ်သည်</h3>
              <p className="mt-2 text-slate-500">လုပ်ဆောင်ချက်ကို အတည်ပြုရန် PIN ရိုက်ထည့်ပါ</p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-6">
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinValue}
                  onChange={(e) => {
                    setPinValue(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setPinError("");
                  }}
                  placeholder="• • • • • •"
                  maxLength="6"
                  className="w-full px-4 py-4 text-center text-3xl tracking-[0.5em] font-bold border-2 border-slate-200 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all"
                  autoFocus
                />
                {pinError && (
                  <p className="mt-3 text-sm text-center text-rose-600 font-medium">{pinError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-slate-100 py-4 text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinValue("");
                    setPinError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pinValue.length !== 6 || isSubmitting}
                  className="flex-1 rounded-xl bg-cyan-600 py-4 text-sm font-bold text-white hover:bg-cyan-700 shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  အတည်ပြုသည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {permanentDeletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-rose-900/50 bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-500">
              ⚠️
            </div>
            <h3 className="mt-4 text-xl font-semibold text-slate-900">Permanent Delete?</h3>
            <p className="mt-2 text-slate-600">
              &quot;{permanentDeletingCustomer.name}&quot; ကို အပြီးတိုင်ဖျက်ရန် သေချာပါသလား? ဤလုပ်ဆောင်ချက်ကို ပြန်ပြင်၍မရပါ။ စာရင်းဇယားများအားလုံး ပျက်သွားပါလိမ့်မည်။
            </p>
            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-md bg-slate-200 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                onClick={() => setPermanentDeletingCustomer(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-md bg-rose-600 py-3 text-sm font-semibold text-slate-900 hover:bg-rose-500 disabled:opacity-50"
                onClick={permanentDeleteCustomer}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
