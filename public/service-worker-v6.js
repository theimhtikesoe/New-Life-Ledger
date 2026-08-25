const CACHE_NAME = 'new-life-ledger-v6';
const API_TIMEOUT_MS = 12_000;
const PAGE_TIMEOUT_MS = 15_000;
const urlsToCache = [
  '/',
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => (
      cache.addAll(urlsToCache).catch((err) => {
        console.warn('Cache addAll error:', err);
      })
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
    event.respondWith(fetchWithTimeout(event.request, API_TIMEOUT_MS).catch(() => offlineApiResponse()));
    return;
  }

  event.respondWith(
    fetchWithTimeout(event.request, PAGE_TIMEOUT_MS)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
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
