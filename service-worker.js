/* --------------------------------------------------
   NexariOS Service Worker — Clean Auto-Update
-------------------------------------------------- */

const CACHE_NAME = "nexarios-cache-v1";

/* --------------------------------------------------
   INSTALL — Skip waiting so updates apply immediately
-------------------------------------------------- */
self.addEventListener("install", event => {
    self.skipWaiting();
});

/* --------------------------------------------------
   ACTIVATE — Clear old caches
-------------------------------------------------- */
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            )
        )
    );
    self.clients.claim();
});

/* --------------------------------------------------
   FETCH — Network-first strategy
   Ensures UI always gets the newest version
-------------------------------------------------- */
self.addEventListener("fetch", event => {
    const request = event.request;

    // Only handle GET requests
    if (request.method !== "GET") return;

    event.respondWith(
        fetch(request)
            .then(response => {
                // Clone and store in cache
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                return response;
            })
            .catch(() => {
                // Fallback to cache if offline
                return caches.match(request);
            })
    );
});
