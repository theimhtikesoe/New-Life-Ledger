const CACHE_NAME = 'new-life-ledger-v9';
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

  // API requests must always reach the server directly. The previous worker
  // converted slow/temporary API failures into a fake 503 "Network connection"
  // response, which made populated pages look empty during navigation.
  if (event.request.url.includes('/api/')) return;

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
