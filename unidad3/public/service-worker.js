const CACHE_NAME = "innova-soft-u3-v1";
const CACHE_PREFIX = "innova-soft-u3-";
const scopeUrl = new URL("./", self.location.href);

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const manifestUrl = new URL("precache-manifest.json", scopeUrl);
        const response = await fetch(manifestUrl, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`No se pudo cargar el precache (${response.status}).`);
        }

        const assets = await response.json();
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(assets.map((asset) => new URL(asset, scopeUrl)));
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const requestUrl = new URL(request.url);
    const apiUrl = new URL("api/", scopeUrl);

    if (request.method !== "GET" || requestUrl.origin !== scopeUrl.origin) {
        return;
    }

    if (requestUrl.pathname === apiUrl.pathname
        || requestUrl.pathname.startsWith(`${apiUrl.pathname}`)) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(fetch(request).catch(async () =>
            await caches.match(new URL("index.html", scopeUrl)) || Response.error()
        ));
        return;
    }

    if (!/\.(?:js|css|svg|webmanifest)$/.test(requestUrl.pathname)) {
        return;
    }

    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }

        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
        }
        return response;
    })());
});
