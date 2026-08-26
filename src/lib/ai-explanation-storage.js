const CACHE_KEY = "new-life-ledger-ai-explanation-cache-v1";
const USAGE_KEY = "new-life-ledger-ai-explanation-usage-v1";
const MAX_CACHE_ENTRIES = 90;
export const MAX_DAILY_AI_REQUESTS = 3;

function getDefaultStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readObject(storage, key) {
  try {
    const raw = storage?.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeObject(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function cacheKey(date, actorName) {
  return `${String(actorName || "Staff")}::${String(date || "")}`;
}

export function readAiExplanationCache(date, actorName = "Staff", storage = getDefaultStorage()) {
  if (!date || !storage) return null;
  const value = readObject(storage, CACHE_KEY)[cacheKey(date, actorName)];
  return value && typeof value === "object" && value.explanation ? value.explanation : null;
}

export function saveAiExplanationCache(date, explanation, actorName = "Staff", storage = getDefaultStorage()) {
  if (!date || !explanation || !storage) return false;
  const cache = readObject(storage, CACHE_KEY);
  cache[cacheKey(date, actorName)] = { explanation, savedAt: new Date().toISOString() };
  const entries = Object.entries(cache)
    .sort(([, left], [, right]) => String(right?.savedAt || "").localeCompare(String(left?.savedAt || "")))
    .slice(0, MAX_CACHE_ENTRIES);
  return writeObject(storage, CACHE_KEY, Object.fromEntries(entries));
}

function usageKey(actorName, currentDate) {
  return `${String(currentDate || "")}::${String(actorName || "Staff")}`;
}

export function getDailyAiUsage(actorName, currentDate, storage = getDefaultStorage()) {
  if (!currentDate || !storage) return 0;
  const value = readObject(storage, USAGE_KEY)[usageKey(actorName, currentDate)];
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}

export function recordDailyAiSuccess(actorName, currentDate, storage = getDefaultStorage()) {
  if (!currentDate || !storage) return 0;
  const usage = readObject(storage, USAGE_KEY);
  const key = usageKey(actorName, currentDate);
  usage[key] = getDailyAiUsage(actorName, currentDate, storage) + 1;
  writeObject(storage, USAGE_KEY, usage);
  return usage[key];
}

// Kept as a compatibility alias for older callers. New callers should record
// usage only after a fresh AI explanation has actually been returned.
export function consumeDailyAiUsage(actorName, currentDate, storage = getDefaultStorage()) {
  return recordDailyAiSuccess(actorName, currentDate, storage);
}

export function resetDailyAiUsage(actorName, currentDate, storage = getDefaultStorage()) {
  if (!currentDate || !storage) return 0;
  const usage = readObject(storage, USAGE_KEY);
  delete usage[usageKey(actorName, currentDate)];
  writeObject(storage, USAGE_KEY, usage);
  return 0;
}

export function getAiActivityReviewHref(date, target = {}) {
  const params = new URLSearchParams({ date: date || "", from: "ai" });
  if (typeof target === "string" && target.trim()) params.set("targetText", target.trim().slice(0, 500));
  if (target && typeof target === "object") {
    if (target.customerName) params.set("customer", String(target.customerName).trim().slice(0, 120));
    if (target.amount !== null && target.amount !== undefined && String(target.amount).trim()) params.set("amount", String(target.amount).replace(/,/g, "").trim());
    if (target.action) params.set("action", String(target.action).trim().slice(0, 40));
    if (target.targetText) params.set("targetText", String(target.targetText).trim().slice(0, 500));
  }
  return `/activity?${params.toString()}`;
}
