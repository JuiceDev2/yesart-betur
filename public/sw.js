/* Aura — service worker.
 *
 * Reglas de seguridad (la app maneja sesiones, mensajes y documentos KYC):
 *  - NUNCA se guarda HTML de páginas, respuestas de /api, de /auth ni de Supabase/Stripe.
 *  - Solo se cachean recursos estáticos versionados (/_next/static), íconos y /offline.html.
 *  - Las navegaciones van siempre a la red; sin conexión se muestra /offline.html.
 */
const VERSION = "aura-v1";
const STATIC_CACHE = `${VERSION}-static`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png"];
const MAX_ASSETS = 150;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" })))),
  );
  // No se llama a skipWaiting() aquí: la nueva versión espera a que la persona pulse
  // "Actualizar" (mensaje SKIP_WAITING) para no recargar a mitad de una acción.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => {});
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    cache.put(request, res.clone()).then(() => trim(ASSET_CACHE, MAX_ASSETS));
  }
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return; // streaming de vídeo: que lo gestione el navegador

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, Stripe, etc.: siempre red
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Navegaciones: red primero; sin conexión, página offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          return preload || (await fetch(request));
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          return (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Archivos con hash (inmutables): caché primero.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Íconos y favicons: rápidos, y se refrescan en segundo plano.
  if (/^\/(icon|favicon|apple-touch-icon)/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
