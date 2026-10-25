"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <h1 className="text-2xl font-medium">Algo salió mal</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        Ocurrió un error inesperado. Puedes reintentar o volver al inicio.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="h-10 rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium"
        >
          Inicio
        </Link>
      </div>
    </div>
  );
}
