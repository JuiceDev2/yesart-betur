"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registra el service worker (solo en producción), avisa cuando hay una versión nueva
 * y muestra una franja discreta si se pierde la conexión.
 */
export default function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [offline, setOffline] = useState(false);
  const reloading = useRef(false);
  const updateRequested = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    let cancelled = false;
    let lastCheck = Date.now();
    let registration: ServiceWorkerRegistration | undefined;

    const onControllerChange = () => {
      // Solo se recarga si la persona pidió actualizar; la primera instalación también
      // dispara este evento (clients.claim) y no debe recargar la página.
      if (!updateRequested.current || reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };

    const watch = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller && !cancelled) setWaiting(sw);
        });
      });
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible" || !registration) return;
      if (Date.now() - lastCheck < UPDATE_CHECK_MS) return;
      lastCheck = Date.now();
      registration.update().catch(() => {});
    };

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          registration = reg;
          watch(reg);
        })
        .catch(() => {
          /* sin SW la app sigue funcionando; solo se pierde la página offline */
        });
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisible);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("load", register);
    };
  }, []);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  function applyUpdate() {
    if (!waiting) return;
    updateRequested.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  return (
    <>
      {offline && (
        <div
          role="status"
          className="safe-top fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 bg-accent-soft px-4 py-1.5 text-xs text-accent"
        >
          <WifiOff size={14} aria-hidden="true" />
          Sin conexión · algunas funciones no están disponibles
        </div>
      )}
      {waiting && (
        <div
          role="status"
          className="pwa-banner fixed inset-x-3 z-[80] flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-2xl sm:left-auto sm:max-w-sm"
        >
          <RefreshCw size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm">Hay una nueva versión de Aura.</p>
          <button
            type="button"
            onClick={applyUpdate}
            className="h-10 shrink-0 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
          >
            Actualizar
          </button>
        </div>
      )}
    </>
  );
}
