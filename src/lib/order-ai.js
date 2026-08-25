import { buildOrderExtractionPrompt, normalizeExtractedOrder, ORDER_STRUCTURED_OUTPUT_SCHEMA } from "@/lib/order-utils";

const MANUS_API_BASE = "https://api.manus.ai";
const AI_TIMEOUT_MS = 45_000;
const ATTEMPT_TIMEOUT_MS = 22_000;
const MAX_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 700;
const POLL_INTERVAL_MS = 1_500;
const INITIAL_POLL_DELAY_MS = 750;
const MAX_LIST_MESSAGES_NOT_FOUND_RETRIES = 4;

function safeProviderValue(value) {
  const normalized = String(value || "").trim().replace(/[^A-Za-z0-9_.-]/g, "_");
  return normalized ? normalized.slice(0, 80) : null;
}

function providerError(code, message, metadata = {}) {
  const error = new Error(message);
  error.code = code;
  error.provider = metadata;
  return error;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function sleepUntil(milliseconds, deadline) {
  const delay = Math.min(milliseconds, Math.max(0, deadline - Date.now()));
  if (delay > 0) await sleep(delay);
}

function isRetryableError(error) {
  return [
    "MANUS_RATE_LIMIT",
    "MANUS_SERVICE",
    "MANUS_TIMEOUT",
    "MANUS_NETWORK",
    "MANUS_TRANSIENT_NOT_FOUND",
  ].includes(error?.code) || error?.name === "TypeError";
}

async function fetchProvider(url, options, operation) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw providerError("MANUS_NETWORK", `Order AI ${operation} ချိတ်ဆက်မရပါ။`, {
      phase: operation,
      networkError: safeProviderValue(error?.name || "network"),
    });
  }
}

async function readJson(response, operation) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    const metadata = {
      phase: operation,
      httpStatus: response.status,
      providerCode: safeProviderValue(body?.error?.code || body?.code),
      requestIdPresent: Boolean(body?.request_id),
    };
    if (response.status === 401 || response.status === 403) throw providerError("MANUS_AUTH", "Order AI API key မမှန်ကန်ပါ သို့မဟုတ် ခွင့်ပြုချက် မရှိပါ။", metadata);
    if (response.status === 429) throw providerError("MANUS_RATE_LIMIT", "Order AI request အရေအတွက် ကန့်သတ်ချက် ရောက်နေပါသည်။", metadata);
    if (response.status >= 500) throw providerError("MANUS_SERVICE", "Order AI service ကို ယခုချိန်တွင် မရရှိနိုင်ပါ။", metadata);
    if (response.status === 404 && metadata.providerCode === "not_found") throw providerError("MANUS_TRANSIENT_NOT_FOUND", `Order AI ${operation} မတွေ့သေးပါ။`, metadata);
    if (response.status === 408 || response.status === 425) throw providerError("MANUS_SERVICE", `Order AI ${operation} ခဏမရသေးပါ။`, metadata);
    throw providerError("MANUS_REQUEST", `Order AI ${operation} မအောင်မြင်ပါ။`, metadata);
  }
  return body;
}

function getApiKey() {
  return String(process.env.MANUS_API_KEY || "").trim();
}

async function extractOrderAttempt(text, apiKey, attemptTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), attemptTimeoutMs);
  try {
    const createResponse = await fetchProvider(`${MANUS_API_BASE}/v2/task.create`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-manus-api-key": apiKey },
      body: JSON.stringify({
        title: "New Life Ledger Telegram Order Extraction",
        agent_profile: "manus-1.6-lite",
        share_visibility: "private",
        message: { content: buildOrderExtractionPrompt(text) },
        structured_output_schema: ORDER_STRUCTURED_OUTPUT_SCHEMA,
      }),
    }, "task ဖန်တီးခြင်း");
    const created = await readJson(createResponse, "task ဖန်တီးခြင်း");
    if (!created.task_id) throw providerError("MANUS_REQUEST", "Order AI task ID မရရှိပါ။");

    const deadline = Date.now() + attemptTimeoutMs - 1_000;
    let firstPoll = true;
    let listMessagesNotFoundRetries = 0;
    while (Date.now() < deadline) {
      if (firstPoll) {
        firstPoll = false;
        await sleepUntil(INITIAL_POLL_DELAY_MS, deadline);
      }
      const response = await fetchProvider(`${MANUS_API_BASE}/v2/task.listMessages?task_id=${encodeURIComponent(created.task_id)}&limit=100&order=desc`, {
        method: "GET",
        signal: controller.signal,
        headers: { "x-manus-api-key": apiKey },
      }, "အဖြေစစ်ဆေးခြင်း");
      let body;
      try {
        body = await readJson(response, "အဖြေစစ်ဆေးခြင်း");
        listMessagesNotFoundRetries = 0;
      } catch (error) {
        const isTransientNotFound = response.status === 404 && error?.code === "MANUS_TRANSIENT_NOT_FOUND";
        if (isTransientNotFound && listMessagesNotFoundRetries < MAX_LIST_MESSAGES_NOT_FOUND_RETRIES) {
          listMessagesNotFoundRetries += 1;
          await sleepUntil(POLL_INTERVAL_MS, deadline);
          continue;
        }
        throw error;
      }
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const errorMessage = messages.find((item) => item?.type === "error_message");
      if (errorMessage) {
        throw providerError("MANUS_TASK", "Order AI task မအောင်မြင်ပါ။", {
          phase: "task_error",
          providerErrorType: safeProviderValue(errorMessage?.error_message?.error_type),
          providerContentPresent: Boolean(errorMessage?.error_message?.content),
        });
      }
      const structured = messages.find((item) => item?.type === "structured_output_result");
      if (structured) {
        const result = structured.structured_output_result;
        if (!result?.success) {
          throw providerError("MANUS_TASK", "Order AI က အချက်အလက်ကို မဖတ်နိုင်ပါ။", {
            phase: "structured_output",
            providerErrorPresent: Boolean(result?.error),
          });
        }
        return normalizeExtractedOrder(result.value, text);
      }
      const status = messages.find((item) => item?.type === "status_update")?.status_update?.agent_status;
      if (status === "error") throw providerError("MANUS_TASK", "Order AI task မအောင်မြင်ပါ။", { phase: "status_error" });
      if (status === "stopped") throw providerError("MANUS_EMPTY", "Order AI မှ အချက်အလက် မရရှိပါ။", { phase: "stopped_without_result" });
      if (status === "waiting") throw providerError("MANUS_TASK", "Order AI က ထပ်မံအတည်ပြုချက် စောင့်နေပါသည်။", { phase: "waiting" });
      await sleepUntil(POLL_INTERVAL_MS, deadline);
    }
    throw providerError("MANUS_TIMEOUT", "Order AI အဖြေရရန် အချိန်ကျော်သွားပါပြီ။");
  } catch (error) {
    if (error?.name === "AbortError") throw providerError("MANUS_TIMEOUT", "Order AI အဖြေရရန် အချိန်ကျော်သွားပါပြီ။", { phase: "timeout" });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractOrderFromText(sourceText) {
  const text = String(sourceText || "").trim();
  if (!text) throw new Error("Order စာသား မရှိသေးပါ။");
  const apiKey = getApiKey();
  if (!apiKey) throw providerError("MANUS_AUTH", "Order AI အတွက် MANUS_API_KEY မသတ်မှတ်ရသေးပါ။");

  const startedAt = Date.now();
  let lastError = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const remainingMs = AI_TIMEOUT_MS - (Date.now() - startedAt);
    if (remainingMs < 2_500) break;
    const attemptTimeoutMs = Math.min(ATTEMPT_TIMEOUT_MS, remainingMs - 900);
    try {
      return await extractOrderAttempt(text, apiKey, attemptTimeoutMs);
    } catch (error) {
      lastError = error;
      const willRetry = attempt + 1 < MAX_ATTEMPTS && isRetryableError(error) && Date.now() - startedAt < AI_TIMEOUT_MS - 1_500;
      console.warn("Order AI extraction provider failure", {
        code: error?.code || "UNKNOWN",
        provider: error?.provider || null,
        attempt: attempt + 1,
        willRetry,
      });
      if (!willRetry) throw error;
      await sleep(Math.min(RETRY_BACKOFF_MS, Math.max(100, AI_TIMEOUT_MS - (Date.now() - startedAt) - 1_200)));
    }
  }
  throw lastError || providerError("MANUS_TIMEOUT", "Order AI အဖြေရရန် အချိန်ကျော်သွားပါပြီ။");
}
