// Service Worker: cacht beim ersten Öffnen alle App-Dateien und Inhalte (offline-fähig).
// Bei jedem Deploy CACHE_VERSION erhöhen – dann wird alles atomar neu geladen.
const CACHE_VERSION = "v5";
const CACHE = "cebuano-" + CACHE_VERSION;

const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/answer.js",
  "./js/art.js",
  "./js/charts.js",
  "./js/config.js",
  "./js/content.js",
  "./js/db.js",
  "./js/dropbox.js",
  "./js/lesson.js",
  "./js/lexicon.js",
  "./js/progress.js",
  "./js/pronounce.js",
  "./js/srs.js",
  "./js/stats.js",
  "./js/store.js",
  "./js/sync.js",
  "./js/trainer.js",
  "./js/ui.js",
  "./content/index.json",
  "./content/glossary.json",
  "./content/names.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
      try {
        const idx = await (await cache.match("./content/index.json")).json();
        await Promise.all(idx.units.map((u) => cache.add(`./content/units/${u}.json`).catch(() => null)));
      } catch (_) {}
      // Kein skipWaiting hier: die neue Version wird erst aktiv, wenn der Nutzer im Banner „Neu laden“ wählt
      // (oder keine alte Seite mehr offen ist). So wird nie mitten in einer Lektion neu geladen.
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

// App-Code (HTML/JS/CSS): network-first, damit nie alte und neue Module gemischt werden.
// Inhalte/Icons: cache-first mit Aktualisierung im Hintergrund.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const isNav = event.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
  const key = isNav ? "./index.html" : url.pathname;
  const isCode = isNav || /\.(js|css|webmanifest)$/.test(url.pathname);
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cacheKey = new Request(new URL(key, self.location.href).toString());
      if (isCode) {
        try {
          const res = await fetch(event.request);
          if (res.ok) cache.put(cacheKey, res.clone());
          return res;
        } catch (_) {
          const cached = await cache.match(cacheKey);
          if (cached) return cached;
          throw _;
        }
      }
      const cached = await cache.match(cacheKey);
      if (cached) {
        fetch(event.request).then((res) => { if (res.ok) cache.put(cacheKey, res.clone()); }).catch(() => {});
        return cached;
      }
      const res = await fetch(event.request);
      if (res.ok) cache.put(cacheKey, res.clone());
      return res;
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
