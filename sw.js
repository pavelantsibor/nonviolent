/**
 * Минимальный Service Worker: кэш оболочки для офлайн-открытия стартовой страницы.
 * Полная офлайн-работа модулей требует предварительного посещения в сети (ES-модули).
 */
const CACHE_NAME = "nvc-trainer-shell-v1";
const SHELL = ["./index.html", "./css/styles.css", "./manifest.webmanifest", "./icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        SHELL.map((url) =>
          cache.add(url).catch(() => {
            /* ignore missing during dev */
          })
        )
      )
    )
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
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((r) => r || caches.match("./index.html")))
  );
});
