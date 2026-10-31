// Service Worker: cacht beim ersten Öffnen alle App-Dateien und Inhalte (offline-fähig).
// Bei neuen Inhalten CACHE_VERSION erhöhen.
const CACHE_VERSION = "v1";
const CACHE = "cebuano-" + CACHE_VERSION;

const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/answer.js",
  "./js/charts.js",
  "./js/config.js",
  "./js/content.js",
  "./js/db.js",
  "./js/dropbox.js",
  "./js/lesson.js",
  "./js/lexicon.js",
  "./js/progress.js",
  "./js/srs.js",
  "./js/stats.js",
  "./js/sync.js",
  "./js/trainer.js",
  "./js/ui.js",
  "./content/index.json",
  "./content/glossary.json",
  "./content/names.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
      // Units aus index.json nachladen (fehlende Units sind kein Fehler)
      try {
        const idx = await (await cache.match("./content/index.json")).json();
        await Promise.all(
          idx.units.map((u) => cache.add(`./content/units/${u}.json`).catch(() => null)),
        );
      } catch (_) {}
      self.skipWaiting();
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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  // Dropbox-API nie cachen
  if (url.origin !== self.location.origin) return;
  // OAuth-Redirect mit ?code= soll die normale Seite liefern
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const key = url.pathname.endsWith("/") ? "./index.html" : event.request;
      const cached = await cache.match(key, { ignoreSearch: true });
      if (cached) {
        // Inhalte im Hintergrund aktualisieren (stale-while-revalidate)
        fetch(event.request).then((res) => { if (res.ok) cache.put(event.request, res.clone()); }).catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      } catch (e) {
        if (event.request.mode === "navigate") return cache.match("./index.html");
        throw e;
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
