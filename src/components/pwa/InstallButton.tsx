"use client";

import { requestInstall, useInstallState } from "./install-store";

/** Enlace "Instalar app" para el pie de página. No se muestra si no es posible instalar. */
export default function InstallButton({ className }: { className?: string }) {
  const { canPrompt, iosHint, installed } = useInstallState();
  if (installed || !(canPrompt || iosHint)) return null;
  return (
    <button type="button" onClick={() => void requestInstall()} className={className}>
      Instalar app
    </button>
  );
}
