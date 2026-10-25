import Link from "next/link";
import Logo from "@/components/Logo";

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "soporte@tu-dominio.com";

export default function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Link href="/" className="inline-flex">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 text-sm leading-relaxed text-muted">
        <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-xs">Última actualización: {updated}</p>
        <p role="note" className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          Borrador de plantilla. Este texto no es asesoría legal: debe ser revisado y adaptado por un abogado de tu jurisdicción
          antes de operar la plataforma.
        </p>
        <div className="legal mt-8 space-y-4 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_a]:text-accent [&_a]:underline">
          {children}
        </div>
      </main>
    </div>
  );
}
