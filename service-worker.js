// ---------------------------------------------------------
// NexariOS — Patched Service Worker
// Fixes: cache freeze, stale UI, old index served forever
// Forces instant updates + clean cache versioning
// ---------------------------------------------------------

const CACHE_VERSION = "nexarios-v4";
const CACHE_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/icon-192.svg",
  "/icon-512.svg",
  "/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(CACHE_ASSETS).catch(() => {}))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put("/", clone));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  if (CACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then(cached => {
        return (
          cached ||
          fetch(req).then(res => {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(req, clone));
            return res;
          })
        );
      })
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(req, clone));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
