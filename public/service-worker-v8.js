const CACHE_NAME = 'new-life-ledger-v8';
const API_TIMEOUT_MS = 12_000;
const AI_API_TIMEOUT_MS = 55_000;
const PAGE_TIMEOUT_MS = 20_000;
const urlsToCache = [
  '/',
  '/daily-summary',
  '/activity',
  '/balance-detail',
  '/orders',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function offlineApiResponse() {
  return new Response(JSON.stringify({ ok: false, error: 'Network connection မရသေးပါ။ ခဏနားပြီး ပြန်စမ်းကြည့်ပါ။' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isDailySummaryAiRequest(request) {
  return new URL(request.url).pathname === '/api/ai/daily-summary';
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => (
      Promise.allSettled(urlsToCache.map((url) => cache.add(url)))
    ))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => (
        cacheName !== CACHE_NAME ? caches.delete(cacheName) : undefined
      ))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.url.includes('/api/')) {
    const timeoutMs = isDailySummaryAiRequest(event.request) ? AI_API_TIMEOUT_MS : API_TIMEOUT_MS;
    event.respondWith(fetchWithTimeout(event.request, timeoutMs).catch(() => offlineApiResponse()));
    return;
  }

  event.respondWith(
    fetchWithTimeout(event.request, PAGE_TIMEOUT_MS)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone)));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((response) => (
        response || new Response('Offline - Resource not available', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' }),
        })
      )))
  );
});
