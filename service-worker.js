/* Bisaya Lebendig — Service Worker fuer Offline-Nutzung.
   Netzwerk-first fuer die Hauptseite (index.html/Navigation), damit alle Browser
   immer die aktuelle Version bekommen sobald Internet da ist. Cache dient nur als
   Offline-Fallback und fuer statische Assets (Icons, Audio), die sich selten aendern. */

const CACHE_NAME = "bisaya-lebendig-v2";
const OFFLINE_URLS = [
  "./",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Nur eigene Origin behandeln, externe Dienste (Firebase, Stripe, Fonts...) unangetastet lassen.
  if (!event.request.url.startsWith(self.location.origin)) return;

  const isNavigation = event.request.mode === "navigate" ||
    event.request.destination === "document";

  if (isNavigation) {
    // Netzwerk-first: immer die aktuelle Seite laden, wenn online.
    // Nur bei fehlendem Netz auf den letzten gecachten Stand zurueckfallen.
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./")))
    );
    return;
  }

  // Statische Assets (Icons, Audio, manifest...): cache-first mit Hintergrund-Update.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
