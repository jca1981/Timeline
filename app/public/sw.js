// **** Service Worker: offline-first PWA (M10) ****
// V2: kun immutables cache-first, kun same-origin OK-svar, og aldrig HTML som .json/manifest.
const CACHE_NAME = 'timeline-v2';
const IMMUTABLE = '/Timeline/assets/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(['/Timeline/', '/Timeline/manifest.json']).catch(() => undefined))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

const sameOriginJson = (res) =>
  res.ok && res.type === 'default' && new URL(res.url).origin === self.location.origin &&
  !/text\/html/i.test(res.headers.get('content-type') ?? '');

/** Gem kun pålidelige same-origin-svar (aldrig en 404/HTML-fallback som "json"). */
async function cacheGood(request, response) {
  if (!sameOriginJson(response)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation: network-first, fallback til cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/Timeline/').then((r) => r ?? caches.match('/Timeline/index.html')))
    );
    return;
  }

  // Hashed build-filer: cache-first (de er immutable)
  if (url.pathname.startsWith(IMMUTABLE)) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached ?? fetch(event.request).then((res) => { void cacheGood(event.request, res); return res; })
      )
    );
    return;
  }

  // Alt andet (inkl. manifest.json og data-json): netværk først, cache som fallback.
  // En fejlregistreret manifest (HTML i steden for JSON) giver ellers "Manifest: Syntax error".
  event.respondWith(
    fetch(event.request)
      .then((res) => { if (url.pathname.startsWith('/Timeline/')) void cacheGood(event.request, res); return res; })
      .catch(() => caches.match(event.request).then((r) => r ?? Response.error()))
  );
});

// Tjek jævnligt for ny version af sw.js (ellers hænger gamle caches hængende i dagevis).
setInterval(() => { self.registration.update().catch(() => undefined); }, 60 * 60 * 1000);
