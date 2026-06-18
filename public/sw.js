// Sage & Spoon service worker. Strategy by request type:
//  - navigations (HTML): network-first, so a fresh deploy's shell loads
//    immediately when online; the cached shell is only the offline fallback.
//    (Cache-first navigations served a stale shell for one load after deploy.)
//  - hashed build assets (/assets/*): cache-first — Vite fingerprints the
//    filenames, so a cached copy is always correct and instant.
//  - everything else same-origin (icons, manifest): stale-while-revalidate.
// Recipe photos are cross-origin (Flickr / Wikimedia / rawpixel / StockSnap);
// they get their own capped runtime cache so they keep showing offline once
// viewed (the lighter alternative to self-hosting). Other cross-origin requests
// (the Claude API, Google Fonts) are left to the network.
const CACHE = "sage-spoon-v2";
const IMG_CACHE = "sage-spoon-img-v1";
const IMG_CACHE_MAX = 320; // ~one full cookbook's worth of viewed photos

const KEEP = new Set([CACHE, IMG_CACHE]);

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
  precacheLocalImages(); // non-blocking background warm-up
});

const isNavigation = (request) => request.mode === "navigate";
const isHashedAsset = (url) => url.pathname.includes("/assets/");
const isImage = (request) => request.destination === "image";

// Cache-first for images (incl. cross-origin recipe photos), so a viewed photo
// loads instantly and survives going offline. Opaque (no-cors) responses can't
// be inspected, so they're cached as-is; the cache is trimmed to a cap. A miss
// while offline rejects, and RecipeImage falls back to its gradient.
async function imageCache(request) {
  const cache = await caches.open(IMG_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    await cache.put(request, response.clone());
    trimCache(IMG_CACHE, IMG_CACHE_MAX);
  }
  return response;
}

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, keys.length - max)) await cache.delete(key); // evict oldest first
}

// After activation, warm the image cache with all self-hosted recipe photos so
// they're available offline before first view. Non-blocking — a miss just falls
// back to the gradient placeholder, same as before self-hosting.
async function precacheLocalImages() {
  try {
    const base = self.registration.scope;
    const res = await fetch(base + "recipe-images/manifest.json");
    if (!res.ok) return;
    const paths = await res.json();
    if (!Array.isArray(paths)) return;
    const cache = await caches.open(IMG_CACHE);
    for (const path of paths) {
      if (typeof path !== "string") continue;
      const url = base + path;
      if (await cache.match(url)) continue;
      try {
        const r = await fetch(url);
        if (r.ok) await cache.put(url, r);
      } catch { /* skip individual failures */ }
    }
  } catch { /* non-fatal */ }
}

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

  // Images first — these are the only cross-origin requests we cache.
  if (isImage(request)) { event.respondWith(imageCache(request)); return; }
  if (url.origin !== self.location.origin) return; // other cross-origin → network

  if (isNavigation(request)) event.respondWith(networkFirst(request));
  else if (isHashedAsset(url)) event.respondWith(cacheFirst(request));
  else event.respondWith(staleWhileRevalidate(request));
});
