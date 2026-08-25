import { buildOrderExtractionPrompt, normalizeExtractedOrder, ORDER_STRUCTURED_OUTPUT_SCHEMA } from "@/lib/order-utils";

const MANUS_API_BASE = "https://api.manus.ai";
const AI_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 1_500;

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
    throw providerError("MANUS_REQUEST", `Order AI ${operation} မအောင်မြင်ပါ။`, metadata);
  }
  return body;
}

function getApiKey() {
  return String(process.env.MANUS_API_KEY || "").trim();
}

export async function extractOrderFromText(sourceText) {
  const text = String(sourceText || "").trim();
  if (!text) throw new Error("Order စာသား မရှိသေးပါ။");
  const apiKey = getApiKey();
  if (!apiKey) throw providerError("MANUS_AUTH", "Order AI အတွက် MANUS_API_KEY မသတ်မှတ်ရသေးပါ။");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const createResponse = await fetch(`${MANUS_API_BASE}/v2/task.create`, {
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
    });
    const created = await readJson(createResponse, "task ဖန်တီးခြင်း");
    if (!created.task_id) throw providerError("MANUS_REQUEST", "Order AI task ID မရရှိပါ။");

    const deadline = Date.now() + AI_TIMEOUT_MS - 1_000;
    while (Date.now() < deadline) {
      const response = await fetch(`${MANUS_API_BASE}/v2/task.listMessages?task_id=${encodeURIComponent(created.task_id)}&limit=100&order=desc`, {
        method: "GET",
        signal: controller.signal,
        headers: { "x-manus-api-key": apiKey },
      });
      const body = await readJson(response, "အဖြေစစ်ဆေးခြင်း");
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
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw providerError("MANUS_TIMEOUT", "Order AI အဖြေရရန် အချိန်ကျော်သွားပါပြီ။");
  } catch (error) {
    if (error?.name === "AbortError") throw providerError("MANUS_TIMEOUT", "Order AI အဖြေရရန် အချိန်ကျော်သွားပါပြီ။", { phase: "timeout" });
    console.error("Order AI extraction provider failure", {
      code: error?.code || "UNKNOWN",
      provider: error?.provider || null,
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
