import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de uso",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <Link href="/" className="font-serif text-xl font-semibold">
            Galería<span className="text-accent">Viva</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-muted">
        <h1 className="font-serif text-3xl font-medium text-foreground">Términos de uso</h1>
        <p className="mt-6">
          Galería Viva es un intermediario de contacto entre artistas y clientes. El
          precio, la entrega, el pago y cualquier acuerdo se celebran directamente entre
          las partes. La plataforma no garantiza la calidad de las obras ni el resultado
          de los servicios de mural.
        </p>
        <p className="mt-4">
          Los artistas son responsables del contenido que publican. El administrador puede
          ocultar contenido o deshabilitar cuentas que incumplan la ley o estas reglas.
        </p>
        <p className="mt-4">
          Al enviar una solicitud de compra aceptas que el artista (y, si aplica, el
          equipo de la plataforma) use los datos de contacto que proporcionaste solo para
          esa solicitud.
        </p>
        <p className="mt-12">
          <Link href="/privacy" className="text-accent underline">
            Aviso de privacidad
          </Link>
        </p>
      </main>
    </div>
  );
}
