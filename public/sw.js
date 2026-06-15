// Sage & Spoon service worker — a small runtime cache so the plan, cookbook,
// and shopping list keep working offline once the app has been opened. There's
// no precache manifest on purpose: assets are cached as they're requested, so
// this stays correct across Vite's hashed filenames and the GitHub Pages base
// path without any build-time wiring. Cross-origin requests (the Claude API,
// Google Fonts) are left to the network.
const CACHE = "sage-spoon-v1";

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

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      // Cache-first for instant loads and offline; refresh in the background.
      const fromNetwork = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() =>
          request.mode === "navigate" ? cache.match(self.registration.scope) : undefined,
        );
      return cached || fromNetwork;
    })(),
  );
});
