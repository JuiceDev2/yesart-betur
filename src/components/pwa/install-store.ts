"use client";

import { useSyncExternalStore } from "react";

/**
 * Estado de instalación de la PWA, compartido entre el banner y el botón del pie.
 * - Chrome/Edge/Android/Samsung: se captura `beforeinstallprompt` y se dispara a petición.
 * - iOS/iPadOS: no existe ese evento; se muestran instrucciones ("Añadir a inicio").
 */

type InstallOutcome = "accepted" | "dismissed";
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome }>;
}

export interface InstallState {
  /** El navegador permite lanzar el diálogo nativo de instalación. */
  canPrompt: boolean;
  /** iOS fuera de modo standalone: hay que explicar el menú Compartir. */
  iosHint: boolean;
  /** Ya se ejecuta como app instalada. */
  installed: boolean;
  /** Se pidió mostrar las instrucciones manualmente (botón del pie). */
  helpOpen: boolean;
}

const SERVER_STATE: InstallState = { canPrompt: false, iosHint: false, installed: false, helpOpen: false };

let deferred: BeforeInstallPromptEvent | null = null;
let helpOpen = false;
let wasInstalled = false;
let snapshot: InstallState = SERVER_STATE;
let started = false;
const listeners = new Set<() => void>();

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIosSafariLike(): boolean {
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/i.test(ua) || iPadOs;
  const inApp = /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|Snapchat/i.test(ua);
  return ios && !inApp;
}

function compute(): InstallState {
  const installed = wasInstalled || isStandalone();
  return {
    canPrompt: deferred !== null && !installed,
    iosHint: !installed && deferred === null && isIosSafariLike(),
    installed,
    helpOpen,
  };
}

function emit() {
  const next = compute();
  const prev = snapshot;
  if (
    prev.canPrompt === next.canPrompt &&
    prev.iosHint === next.iosHint &&
    prev.installed === next.installed &&
    prev.helpOpen === next.helpOpen
  ) {
    return;
  }
  snapshot = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  snapshot = compute();
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    wasInstalled = true;
    helpOpen = false;
    emit();
  });
  window.matchMedia("(display-mode: standalone)").addEventListener("change", emit);
}

// Se registra al cargar el módulo para no perder un evento que llegue antes de hidratar.
start();

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER_STATE);
}

/** Lanza el diálogo nativo (si existe) o abre las instrucciones manuales. */
export async function requestInstall(): Promise<InstallOutcome | "manual" | "unavailable"> {
  if (deferred) {
    const evt = deferred;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    deferred = null; // el evento solo puede usarse una vez
    emit();
    return outcome;
  }
  if (snapshot.iosHint) {
    setHelpOpen(true);
    return "manual";
  }
  return "unavailable";
}

export function setHelpOpen(open: boolean) {
  helpOpen = open;
  emit();
}
