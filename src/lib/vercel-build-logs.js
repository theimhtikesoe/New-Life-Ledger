const VERCEL_API_BASE = "https://api.vercel.com";
const DEFAULT_DEPLOYMENT_LIMIT = 8;
const DEFAULT_EVENT_LIMIT = 500;
const MAX_EVENT_TEXT_LENGTH = 4_000;
const REQUEST_TIMEOUT_MS = 10_000;

const SECRET_KEY_PATTERN = "APP_PIN|APP_SESSION_SECRET|CRON_SECRET|DATABASE_URL|DIRECT_URL|MANUS_API_KEY|TELEGRAM_BOT_TOKEN|TELEGRAM_ORDER_WEBHOOK_SECRET|TELEGRAM_ORDER_ADMIN_IDS|KPAY_WEBHOOK_SECRET|VERCEL_API_TOKEN|VERCEL_OIDC_TOKEN|VERCEL_AUTOMATION_BYPASS_SECRET";

function safeText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n");
}

export function redactBuildLogText(value) {
  let text = safeText(value);
  text = text.replace(new RegExp(`(${SECRET_KEY_PATTERN})\\s*([:=])\\s*([^\\s,;]+)`, "gi"), "$1$2[REDACTED]");
  text = text.replace(/(authorization\s*:\s*bearer\s+|bearer\s+)([^\s]+)/gi, "$1[REDACTED]");
  text = text.replace(/([?&](?:token|key|secret|password)=)[^&\s]+/gi, "$1[REDACTED]");
  return text;
}

function getConfig() {
  const token = String(process.env.VERCEL_API_TOKEN || "").trim();
  const projectId = String(process.env.VERCEL_PROJECT_ID || "").trim();
  const teamId = String(process.env.VERCEL_TEAM_ID || "").trim();
  const viewerActors = String(process.env.VERCEL_BUILD_LOG_VIEWER_ACTORS || "ဖေဖေ")
    .split(",")
    .map((actor) => actor.trim())
    .filter(Boolean);
  return { token, projectId, teamId, viewerActors };
}

export function getVercelBuildLogViewerConfig() {
  const { token, projectId, teamId, viewerActors } = getConfig();
  return {
    configured: Boolean(token && projectId),
    hasToken: Boolean(token),
    hasProject: Boolean(projectId),
    teamConfigured: Boolean(teamId),
    viewerActors,
  };
}

export function isAllowedVercelBuildLogActor(actorName) {
  const { viewerActors } = getConfig();
  return viewerActors.includes(String(actorName || "").trim());
}

function createQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") query.set(key, String(value));
  }
  return query.toString();
}

async function vercelFetch(path, params = {}) {
  const { token, projectId, teamId } = getConfig();
  if (!token || !projectId) {
    const error = new Error("Vercel build logs အတွက် server setting မပြည့်စုံသေးပါ။");
    error.code = "VERCEL_NOT_CONFIGURED";
    throw error;
  }

  const query = createQuery({ ...params, teamId });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${VERCEL_API_BASE}${path}${query ? `?${query}` : ""}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(response.status === 401 || response.status === 403
        ? "Vercel build logs ကြည့်ရန် API ခွင့်ပြုချက် မရှိပါ။"
        : "Vercel build logs ရယူ၍ မရပါ။");
      error.code = response.status === 401 || response.status === 403 ? "VERCEL_AUTH" : "VERCEL_REQUEST";
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Vercel build logs ရယူရန် အချိန်ကြာသွားပါပြီ။");
      timeoutError.code = "VERCEL_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeDeployment(deployment) {
  return {
    uid: String(deployment?.uid || ""),
    name: String(deployment?.name || ""),
    url: deployment?.url ? String(deployment.url) : null,
    inspectorUrl: deployment?.inspectorUrl ? String(deployment.inspectorUrl) : null,
    createdAt: deployment?.createdAt || deployment?.created || null,
    readyState: String(deployment?.readyState || deployment?.state || "UNKNOWN"),
    target: deployment?.target ? String(deployment.target) : null,
    commitSha: deployment?.meta?.githubCommitSha ? String(deployment.meta.githubCommitSha) : null,
    branch: deployment?.meta?.githubCommitRef ? String(deployment.meta.githubCommitRef) : null,
    errorCode: deployment?.errorCode ? String(deployment.errorCode) : null,
    errorMessage: deployment?.errorMessage ? redactBuildLogText(deployment.errorMessage) : null,
  };
}

export async function listVercelDeployments({ limit = DEFAULT_DEPLOYMENT_LIMIT } = {}) {
  const body = await vercelFetch("/v7/deployments", {
    projectId: getConfig().projectId,
    target: "production",
    limit: Math.min(Math.max(Number(limit) || DEFAULT_DEPLOYMENT_LIMIT, 1), 20),
  });
  return Array.isArray(body?.deployments) ? body.deployments.map(normalizeDeployment).filter((deployment) => deployment.uid) : [];
}

function normalizeEvent(event, index) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const text = event?.text ?? payload.text ?? payload.message ?? "";
  const type = String(event?.type || "event");
  return {
    id: String(event?.id || event?.serial || `${type}-${index}`),
    created: event?.created || event?.date || payload.date || null,
    type,
    level: event?.level || (type === "stderr" || type === "fatal" ? "error" : "info"),
    text: redactBuildLogText(text).slice(0, MAX_EVENT_TEXT_LENGTH),
  };
}

export async function getVercelDeploymentEvents(deploymentId) {
  const value = String(deploymentId || "").trim();
  if (!value) return [];
  const body = await vercelFetch(`/v3/deployments/${encodeURIComponent(value)}/events`, {
    direction: "forward",
    follow: 0,
    limit: DEFAULT_EVENT_LIMIT,
    builds: 1,
  });
  return Array.isArray(body) ? body.map(normalizeEvent).filter((event) => event.text || event.type !== "event") : [];
}

export function getSafeVercelError(error) {
  const code = error?.code;
  if (code === "VERCEL_NOT_CONFIGURED") return "Vercel build logs ကြည့်ရန် server setting မထည့်ရသေးပါ။ VERCEL_API_TOKEN နှင့် VERCEL_PROJECT_ID ကို Vercel Environment Variables တွင်သာ ထည့်ပါ။";
  if (code === "VERCEL_AUTH") return "Vercel build logs ကြည့်ရန် token ခွင့်ပြုချက် မရှိပါ။ Token ကို ပြန်စစ်ပြီး Production environment သို့ ထည့်ထားကြောင်း စစ်ပါ။";
  if (code === "VERCEL_TIMEOUT") return "Vercel build logs ရယူရန် အချိန်ကြာသွားပါပြီ။ ပြန်လည်ရယူရန် နှိပ်ပါ။";
  return "Vercel build logs ရယူ၍ မရပါ။ Vercel project setting နှင့် network ကို ပြန်စစ်ပါ။";
}

export const VERCEL_BUILD_LOG_LIMITS = {
  deploymentLimit: DEFAULT_DEPLOYMENT_LIMIT,
  eventLimit: DEFAULT_EVENT_LIMIT,
  maxEventTextLength: MAX_EVENT_TEXT_LENGTH,
};

export default {
  getVercelBuildLogViewerConfig,
  isAllowedVercelBuildLogActor,
  listVercelDeployments,
  getVercelDeploymentEvents,
  getSafeVercelError,
  redactBuildLogText,
};
