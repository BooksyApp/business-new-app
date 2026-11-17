/* booqi Business service worker (FG-W2-130). Hand-written on purpose: no Workbox, no plugin.
 *
 * What it does, and only this:
 *   - page loads (navigations): network first, so a deploy is picked up on the next load.
 *     With no network the offline page is shown (not a cached app shell: an app that boots
 *     with no API would show a salon empty screens or sign them out).
 *   - /assets/*: Vite's content-hashed, immutable files - cache first, filled at install
 *     (the entry and what it imports) and as lazily loaded pages are opened.
 *   - everything else, and always /api/** and /ws/**: not touched (straight to the network,
 *     never stored). Nothing authenticated is ever put in a cache.
 *
 * Updates: BUILD below is replaced at build time (vite.config.ts) with a hash of the build,
 * so every deploy is a new worker with a new cache name; the old caches are deleted when it
 * activates. The page asks a waiting worker to take over at the start of the next load
 * (src/lib/pwa.ts), never in the middle of one.
 */
const BUILD = "__BOOQI_SW_BUILD__";
const SHELL = [/*__BOOQI_SW_SHELL__*/];
const PREFIX = "booqi-hub-";
const CACHE = PREFIX + BUILD;
const OFFLINE_URL = "/offline.html";

// Never handled by the worker: the API, the realtime socket (SockJS falls back to HTTP),
// and the ops console path.
const BYPASS = /^\/(api|ws|super-cloundo)(\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all([
        // The offline page must be there, or the worker is useless offline: fail the install.
        cache.add(new Request(OFFLINE_URL, { cache: "reload" })),
        // The rest only speeds the start up; a file that fails is fetched later as usual.
        ...SHELL.filter((u) => u !== OFFLINE_URL).map((u) =>
          cache
            .add(new Request(u, { cache: u.startsWith("/assets/") ? "default" : "reload" }))
            .catch(() => undefined),
        ),
      ]),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
      // The HTML request starts while the worker boots instead of after it.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (BYPASS.test(url.pathname) || req.headers.has("authorization")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          return preloaded || (await fetch(req));
        } catch {
          return (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") && !req.headers.has("range")) {
    event.respondWith(fromCacheThenNetwork(event, req));
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req)));
  }
});

async function fromCacheThenNetwork(event, req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  // Only a real file: never an error, a redirect, or the SPA's index.html answered for a
  // missing asset (that would be served for that name until the next deploy).
  const type = res.headers.get("content-type") || "";
  if (res.ok && res.type === "basic" && !type.includes("text/html")) {
    event.waitUntil(cache.put(req, res.clone()).catch(() => undefined));
  }
  return res;
}
