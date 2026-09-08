const CACHE_NAME = "posterr-v1";
const STATIC_CACHE = "posterr-static-v1";

function getScopePath() {
  const scopeUrl = new URL(self.registration.scope);
  const scopePath = scopeUrl.pathname.replace(/\/$/, "");
  return scopePath === "/" ? "" : scopePath;
}

function withScope(path) {
  return `${getScopePath()}${path}`;
}

self.addEventListener("install", (event) => {
  const coreAssets = [
    "/",
    "/css/bootstrap.min.css",
    "/css/font-awesome.min.css",
    "/css/styles.css",
    "/js/jquery-3.3.1.slim.min.js",
    "/js/bootstrap.min.js",
    "/images/no-poster-available.png",
    "/favicons/favicon.ico",
    "/favicons/android-chrome-192x192.png",
    "/favicons/android-chrome-512x512.png",
    "/site.webmanifest"
  ].map(withScope);

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(coreAssets)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(withScope("/"))))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
