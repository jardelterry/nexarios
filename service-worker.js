// ---------------------------------------------------------
// NexariOS — Patched Service Worker
// Fixes: cache freeze, stale UI, old index served forever
// Forces instant updates + clean cache versioning
// ---------------------------------------------------------

// 🔥 Bump this version ANY time you deploy
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

// ---------------------------------------------------------
// 1. INSTALL — force new SW to activate immediately
// ---------------------------------------------------------
self.addEventListener("install", event => {
  self.skipWaiting(); // 🔥 critical: replaces old SW instantly

  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(CACHE_ASSETS).catch(() => {
        // Ignore failures (offline install)
      });
    })
  );
});

// ---------------------------------------------------------
// 2. ACTIVATE — delete old caches + take control immediately
// ---------------------------------------------------------
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key)) // 🔥 removes old frozen caches
      )
    )
  );

  clients.claim(); // 🔥 ensures new SW controls all tabs instantly
});

// ---------------------------------------------------------
// 3. FETCH — network-first for HTML, cache-first for assets
// ---------------------------------------------------------
self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // Always fetch fresh index.html (prevents stale UI)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Update cache with fresh index
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put("/", clone));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // For static assets → cache-first
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

  // Everything else → network-first fallback to cache
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
