const STATIC_CACHE = "manpharma-static-v8";
const DYNAMIC_CACHE = "manpharma-dynamic-v8";
const REPO_BASE = "/ManPharma-Productivity/";
const BASE_PATH = self.location.pathname.startsWith(REPO_BASE) ? REPO_BASE : "/";
const OFFLINE_URL = `${BASE_PATH}offline.html`;
const APP_SHELL = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}offline.html`,
  `${BASE_PATH}styles.css`,
  `${BASE_PATH}storage.js`,
  `${BASE_PATH}ui.js`,
  `${BASE_PATH}main.js`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}icons/apple-touch-icon.png`,
  `${BASE_PATH}icons/icon-192.png`,
  `${BASE_PATH}icons/icon-512.png`
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![STATIC_CACHE, DYNAMIC_CACHE].includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const staticAsset = /(\.js|\.css|\.html|\.json|\.png|\.svg|\.ico|\.woff2?|\.ttf)$/i.test(url.pathname);
  const inScopePath = url.pathname.startsWith(BASE_PATH);

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Cache-first for static assets with network fallback.
  if (sameOrigin && inScopePath && staticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => caches.match(OFFLINE_URL));
      })
    );
    return;
  }

  // Dynamic cache for other same-origin requests.
  if (sameOrigin && inScopePath) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            const copy = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => caches.match(OFFLINE_URL));
      })
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
