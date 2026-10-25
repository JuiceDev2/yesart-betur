import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CreatorCard from "@/components/CreatorCard";
import { getCurrency, getFeaturedCreators } from "@/lib/data/creators";

const FAQ = [
  {
    q: "¿Cómo se me cobra?",
    a: "Las suscripciones se renuevan cada mes hasta que las canceles; el acceso continúa hasta el final del periodo que ya pagaste. Las publicaciones de pago y las propinas son cobros únicos.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí. Cancelas desde «Suscripciones» y conservas el acceso hasta que termine el periodo pagado. No hay permanencia.",
  },
  {
    q: "¿Cuánto se queda la plataforma?",
    a: "Una comisión sobre cada cobro, que se muestra en tu panel de ingresos. Lo que ves como «neto» es lo que puedes retirar.",
  },
  {
    q: "¿Cómo verifican a los creadores?",
    a: "Cada creador pasa por una revisión manual de identidad y mayoría de edad antes de publicar. Los documentos se eliminan poco después de resolver la solicitud.",
  },
  {
    q: "¿Qué hago si veo contenido que no debería estar aquí?",
    a: "Usa el botón «Reportar» de cada publicación. Los reportes graves (menores, falta de consentimiento, contenido ilegal) ocultan la publicación al instante mientras la revisamos.",
  },
];

export default async function HomePage() {
  const [creators, currency] = await Promise.all([getFeaturedCreators(8), getCurrency()]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Aura",
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="moon overflow-hidden">
          <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.35em] text-accent sm:text-sm">Explora tu universo · +18</p>
            <h1 className="max-w-3xl font-serif text-4xl font-medium leading-[1.08] tracking-tight sm:text-6xl">
              Apoya directamente a quienes <span className="text-gradient">te inspiran</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/75">
              Suscríbete a tus creadores favoritos, desbloquea contenido exclusivo, envía propinas y conversa con ellos.
              Ellos se quedan con la mayor parte de lo que generan.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/explore"
                className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-8 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
              >
                Explorar creadores
              </Link>
              <Link
                href="/become-creator"
                className="inline-flex h-12 items-center justify-center rounded-full border border-accent/50 px-8 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
              >
                Quiero ser creador
              </Link>
            </div>
          </div>
        </section>

        <ul
          aria-label="Valores de Aura"
          className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-10 gap-y-3 px-4 py-8 text-xs uppercase tracking-[0.35em] text-muted sm:px-6"
        >
          {["Sensual", "Exclusiva", "Segura", "Tu espacio"].map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>

        <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="how" className="font-serif text-3xl font-medium">Así funciona</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-3">
            {[
              ["1", "Crea tu cuenta", "Confirma que eres mayor de edad y entra en segundos."],
              ["2", "Elige a quién apoyar", "Sigue gratis o suscríbete mensualmente. Cancelas cuando quieras."],
              ["3", "Disfruta y participa", "Contenido exclusivo, comentarios, mensajes directos y propinas."],
            ].map(([n, t, d]) => (
              <li key={n} className="rounded-3xl border border-border bg-card p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {n}
                </span>
                <h3 className="mt-4 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {creators.length > 0 && (
          <section aria-labelledby="featured" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
            <div className="flex items-end justify-between">
              <h2 id="featured" className="font-serif text-3xl font-medium">Creadores activos</h2>
              <Link href="/explore" className="text-sm text-accent hover:underline">Ver todos →</Link>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {creators.map((c) => (
                <CreatorCard key={c.id} c={c} currency={currency} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="creators" className="border-y border-border bg-card/50">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 id="creators" className="font-serif text-3xl font-medium">¿Creas contenido? Vive de ello</h2>
              <p className="mt-4 text-muted">
                Publica gratis, para suscriptores o con pago por publicación. Programa tus posts, responde mensajes y
                retira tus ganancias desde tu estudio.
              </p>
              <Link
                href="/become-creator"
                className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground px-7 text-sm font-semibold text-background hover:opacity-90"
              >
                Solicitar ser creador
              </Link>
            </div>
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                "Suscripción mensual o seguimiento gratuito",
                "Publicaciones de pago y propinas",
                "Mensajes directos con tus suscriptores",
                "Bloqueo de usuarios y moderación de comentarios",
                "Panel de ingresos y retiros transparentes",
                "Contenido protegido: solo lo ve quien tiene acceso",
              ].map((t) => (
                <li key={t} className="flex gap-2 rounded-2xl border border-border bg-card p-4">
                  <span aria-hidden="true" className="text-accent">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 id="faq" className="font-serif text-3xl font-medium">Preguntas frecuentes</h2>
          <div className="mt-8 divide-y divide-border rounded-3xl border border-border bg-card">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden="true" className="text-accent transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
