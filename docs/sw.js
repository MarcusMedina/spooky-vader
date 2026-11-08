// Offline shell. The cache name is versioned per build (build-site.mjs fills in the two constants below),
// so every deploy invalidates old caches. SMHI requests are cross-origin and never touched here.
const VERSION = "spooky-0f88b7d8bd73";
const SHELL = ["./","index.html","style.css","app.mjs","scare.mjs","classify.mjs","scene.mjs","smhi.mjs","moon.mjs","clouds.mjs","rules.json","texts.sv.json","manifest.webmanifest","icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/scenes/")) {
    // scene layers: cache first, fill on demand
    e.respondWith(caches.open(VERSION).then(async (c) => (await c.match(req)) ?? fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })));
  } else {
    // app files: network first (fresh when online), cache when offline
    e.respondWith(fetch(req).then((r) => { if (r.ok) caches.open(VERSION).then((c) => c.put(req, r.clone())); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((m) => m ?? caches.match("./index.html"))));
  }
});
