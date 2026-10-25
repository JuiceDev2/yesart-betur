import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-6xl text-accent">404</p>
      <h1 className="mt-4 text-2xl font-medium">Página no encontrada</h1>
      <p className="mt-2 text-sm text-muted">El enlace no existe o fue movido.</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-10 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
