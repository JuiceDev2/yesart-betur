"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { requestInstall, setHelpOpen, useInstallState } from "./install-store";

const DISMISS_KEY = "aura:pwa-install-dismissed";
const DISMISS_DAYS = 14;
const SHOW_AFTER_MS = 8000;

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return !!raw && Date.now() - Number(raw) < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * Invitación para instalar la app. Chrome/Edge/Android usan el diálogo nativo;
 * iOS/iPadOS muestra los pasos manuales. No aparece si ya está instalada, si la
 * persona la descartó hace poco o si aún no confirmó su mayoría de edad.
 */
export default function InstallPrompt({ enabled }: { enabled: boolean }) {
  const state = useInstallState();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => setReady(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [enabled]);

  useEffect(() => {
    setDismissed(recentlyDismissed());
  }, []);

  const auto = ready && !dismissed && (state.canPrompt || state.iosHint);
  const manual = state.helpOpen && state.iosHint;
  if (!enabled || state.installed || !(auto || manual)) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* almacenamiento bloqueado: se mostrará de nuevo en otra visita */
    }
    setDismissed(true);
    setHelpOpen(false);
  }

  const ios = state.iosHint && !state.canPrompt;

  return (
    <aside
      aria-label="Instalar Aura"
      className="pwa-banner fixed inset-x-3 z-[70] rounded-2xl border border-border bg-card p-4 shadow-2xl sm:left-auto sm:max-w-sm"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-foreground"
      >
        <X size={18} aria-hidden="true" />
      </button>

      <p className="pr-8 font-semibold">Instala Aura en tu dispositivo</p>
      <p className="mt-1 pr-8 text-sm text-muted">Acceso directo, pantalla completa y carga más rápida.</p>

      {ios ? (
        <ol className="mt-3 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <Share size={18} className="shrink-0 text-accent" aria-hidden="true" />
            <span>Toca <strong>Compartir</strong> en la barra de Safari.</span>
          </li>
          <li className="flex items-center gap-2">
            <SquarePlus size={18} className="shrink-0 text-accent" aria-hidden="true" />
            <span>Elige <strong>Añadir a pantalla de inicio</strong>.</span>
          </li>
        </ol>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={async () => {
              const outcome = await requestInstall();
              if (outcome === "accepted") setDismissed(true);
              if (outcome === "dismissed") dismiss();
            }}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink"
          >
            <Download size={16} aria-hidden="true" />
            Instalar
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="h-11 rounded-full border border-border px-4 text-sm text-muted hover:text-foreground"
          >
            Ahora no
          </button>
        </div>
      )}
    </aside>
  );
}
