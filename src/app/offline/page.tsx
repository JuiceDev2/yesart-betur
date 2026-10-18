import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sin conexión",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="font-serif text-4xl text-accent">Sin conexión</p>
      <h1 className="mt-4 font-serif text-2xl font-medium">No hay internet por ahora</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Revisa tu conexión e inténtalo de nuevo. Tus obras y solicitudes están seguras.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-10 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background"
      >
        Reintentar
      </Link>
    </div>
  );
}
