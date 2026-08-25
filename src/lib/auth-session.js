const SESSION_COOKIE = "nll_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function verifySignature(value, signature, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(value));
}

function getSessionSecret() {
  return String(process.env.APP_SESSION_SECRET || process.env.CRON_SECRET || "").trim();
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getSessionMaxAgeSeconds() {
  return SESSION_MAX_AGE_SECONDS;
}

export async function createSessionToken() {
  const secret = getSessionSecret();
  if (!secret) throw new Error("APP_SESSION_SECRET is not configured");
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({
    version: 1,
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  })));
  const signature = base64UrlEncode(await sign(payload, secret));
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token) {
  const secret = getSessionSecret();
  if (!secret || typeof token !== "string") return false;
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) return false;

  try {
    const validSignature = await verifySignature(payload, base64UrlDecode(encodedSignature), secret);
    if (!validSignature) return false;
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    return parsed?.version === 1 && Number(parsed.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

export async function requestHasValidSession(request) {
  const token = request?.cookies?.get?.(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export function sessionCookieOptions(value) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
