/* Yesart-betur — Service Worker
 *
 * Estrategia (conservadora a propósito, la app maneja sesiones y datos privados):
 *  - Navegación: red primero. Si no hay conexión, se muestra /offline.
 *    Nunca se guardan páginas HTML en caché (evita filtrar contenido de una sesión a otra).
 *  - /_next/static y íconos (inmutables): caché primero.
 *  - Todo lo demás (API, Supabase, POST, auth, admin, artista): pasa directo a la red.
 *
 * Para forzar una actualización en todos los clientes, cambia VERSION.
 */
const VERSION = "v1";
const STATIC_CACHE = `yesart-static-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE = [
  OFFLINE_URL,
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE);

      // Guardar también los CSS/JS que necesita la página offline para verse bien sin red.
      try {
        const res = await fetch(OFFLINE_URL, { cache: "reload" });
        const html = await res.clone().text();
        const assets = new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) || []);
        await Promise.all(
          [...assets].map((url) =>
            fetch(url)
              .then((r) => (r.ok ? cache.put(url, r) : undefined))
              .catch(() => undefined)
          )
        );
      } catch {
        /* sin red durante la instalación de assets extra: no es crítico */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("yesart-") && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /^\/(icon|apple-touch-icon|favicon)[^/]*\.(png|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, fuentes externas, etc.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Navegaciones: red primero, /offline como respaldo.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (
          (await cache.match(OFFLINE_URL)) ||
          new Response("Sin conexión", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      })
    );
    return;
  }

  // Recursos estáticos inmutables: caché primero.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })()
    );
  }
});
