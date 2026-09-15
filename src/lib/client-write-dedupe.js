const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let installed = false;

export function installClientWriteDeduplication() {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  const inFlight = new Map();

  window.fetch = (input, init = {}) => {
    const request = input instanceof Request ? input : null;
    const method = String(init.method || request?.method || "GET").toUpperCase();
    if (!MUTATING_METHODS.has(method)) return originalFetch(input, init);

    // All app mutation forms send JSON strings. If a caller uses a stream or
    // opaque body, leave it untouched rather than consuming or replaying it.
    const body = typeof init.body === "string"
      ? init.body
      : typeof request?.clone === "function"
        ? null
        : init.body == null ? "" : null;
    if (body === null) return originalFetch(input, init);

    const url = typeof input === "string" ? input : request?.url || String(input);
    const headers = new Headers(init.headers || request?.headers || undefined);
    const actor = headers.get("x-actor-name") || "";
    const key = `${method} ${url} ${actor} ${body}`;
    const existing = inFlight.get(key);
    if (existing) return existing.then((response) => response.clone());

    const requestPromise = originalFetch(input, init).then((response) => response);
    inFlight.set(key, requestPromise);
    requestPromise.finally(() => {
      if (inFlight.get(key) === requestPromise) inFlight.delete(key);
    }).catch(() => {});

    // Give every caller its own readable Response body.
    return requestPromise.then((response) => response.clone());
  };
}

export function resetClientWriteDeduplicationForTests() {
  installed = false;
}
