"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 14;

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  return isIos && isSafari;
}

/**
 * Aviso discreto para instalar la app.
 *  - Chrome/Edge/Android: usa el evento beforeinstallprompt.
 *  - iPhone/iPad (Safari): no existe ese evento; se muestran las instrucciones.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIosSafari()) timer = setTimeout(() => setShowIos(true), 4000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignorar */
    }
    setDeferred(null);
    setShowIos(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (!deferred && !showIos) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicación"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-lg"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Instala Yesart-betur</p>
        {deferred ? (
          <>
            <p className="mt-0.5 text-xs text-muted">
              Accede más rápido desde tu pantalla de inicio.
            </p>
            <button
              onClick={install}
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-medium text-background"
            >
              <Download size={14} aria-hidden="true" />
              Instalar
            </button>
          </>
        ) : (
          <p className="mt-0.5 text-xs text-muted">
            Toca <Share size={12} className="inline align-text-bottom" aria-hidden="true" />{" "}
            <span className="font-medium">Compartir</span> y luego{" "}
            <span className="font-medium">Agregar a pantalla de inicio</span>.
          </p>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Cerrar"
        className="shrink-0 rounded-full p-1 text-muted hover:text-foreground"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
