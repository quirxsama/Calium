const CACHE_VERSION = "calium-pwa-v2";
const CACHE_PREFIX = "calium-pwa-";
const STATIC_CACHE = `${CACHE_VERSION}:static`;
const IMAGE_CACHE = `${CACHE_VERSION}:images`;
const OFFLINE_FALLBACK = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0a0a0c" />
    <title>Calium çevrimdışı</title>
    <style>
      :root { color-scheme: dark; --background: #0a0a0c; --card: #131317; --foreground: #f5f5f7; --muted: #a0a3ae; --primary: #f43f5e; --border: #24262e; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 32px 18px; background: radial-gradient(circle at top left, rgba(244, 63, 94, 0.22), transparent 34rem), radial-gradient(circle at bottom right, rgba(251, 113, 133, 0.14), transparent 30rem), var(--background); color: var(--foreground); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(100%, 520px); border: 1px solid var(--border); border-radius: 28px; padding: 28px; background: var(--card); box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35); }
      img { width: 64px; height: 64px; border-radius: 18px; box-shadow: 0 10px 30px rgba(244, 63, 94, 0.25); }
      h1 { margin: 22px 0 12px; font-size: clamp(1.8rem, 7vw, 2.7rem); line-height: 1; letter-spacing: -0.05em; }
      p { margin: 0; color: var(--muted); font-size: 1rem; line-height: 1.7; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
      a, button { min-height: 44px; border-radius: 999px; border: 1px solid var(--border); padding: 0 18px; color: var(--foreground); background: transparent; font: inherit; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
      button { border-color: transparent; background: var(--primary); color: white; }
    </style>
  </head>
  <body>
    <main>
      <img src="/icons/icon-192x192.png" width="64" height="64" alt="Calium" />
      <h1>Şu an çevrimdışısın</h1>
      <p>Calium bağlantı gelince normal çalışmaya devam eder. Kişisel veriler, odalar, video akışları ve API yanıtları güvenlik için çevrimdışı önbellekten sunulmaz.</p>
      <div class="actions">
        <button type="button" onclick="window.location.reload()">Tekrar dene</button>
        <a href="/">Ana sayfa</a>
      </div>
    </main>
  </body>
</html>`;
const CORE_ASSETS = [
  "/manifest.webmanifest",
  "/icon.webp",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
];
const MAX_IMAGE_ENTRIES = 80;

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (shouldBypass(request, url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkOnlyWithOfflineFallback(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.webp" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(staleWhileRevalidateImage(request));
  }
});

function shouldBypass(request, url) {
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/_next/webpack-hmr")) return true;
  if (url.pathname.startsWith("/_next/data/")) return true;
  if (url.pathname.startsWith("/oda/")) return true;
  if (url.pathname.startsWith("/izle/")) return true;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return true;
  if (request.destination === "video" || request.destination === "audio") return true;
  return false;
}

async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(OFFLINE_FALLBACK, {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidateImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok && isCacheableImageResponse(response)) {
        cache.put(request, response.clone());
        trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
      }
      return response;
    })
    .catch(() => cached);

  return cached ?? networkPromise;
}

function isCacheableImageResponse(response) {
  const cacheControl = response.headers.get("cache-control") ?? "";
  if (cacheControl.includes("private") || cacheControl.includes("no-store")) return false;
  return true;
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;

  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}
