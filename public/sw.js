// Sage & Spoon service worker. Strategy by request type:
//  - navigations (HTML): network-first, so a fresh deploy's shell loads
//    immediately when online; the cached shell is only the offline fallback.
//    (Cache-first navigations served a stale shell for one load after deploy.)
//  - hashed build assets (/assets/*): cache-first — Vite fingerprints the
//    filenames, so a cached copy is always correct and instant.
//  - everything else same-origin (icons, manifest): stale-while-revalidate.
// Cross-origin requests (the Claude API, Google Fonts) are left to the network.
const CACHE = "sage-spoon-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

const isNavigation = (request) => request.mode === "navigate";
const isHashedAsset = (url) => url.pathname.includes("/assets/");

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(self.registration.scope)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigation(request)) event.respondWith(networkFirst(request));
  else if (isHashedAsset(url)) event.respondWith(cacheFirst(request));
  else event.respondWith(staleWhileRevalidate(request));
});
