import Image from "next/image";
import Link from "next/link";
import { getFeaturedArtworks } from "@/lib/data/artworks";
import { getFeaturedServices } from "@/lib/data/services";
import { getFeaturedArtists } from "@/lib/data/artists";
import ArtworkCard from "@/components/ArtworkCard";
import ServiceCard from "@/components/ServiceCard";
import SiteHeader from "@/components/SiteHeader";

export const revalidate = 60;

const STEPS = [
  {
    title: "Explora",
    description: "Recorre el catálogo y filtra por categoría, precio o artista.",
    href: "/gallery",
  },
  {
    title: "Solicita",
    description: "Deja tu nombre y teléfono. No hay pago en línea.",
    href: null,
  },
  {
    title: "Conecta",
    description: "El artista te contacta de forma privada para cerrar el trato.",
    href: null,
  },
] as const;

const FAQ = [
  {
    q: "¿Cómo compro una obra?",
    a: "Elige la obra en el catálogo, pulsa solicitar y deja tu nombre y teléfono. El artista te contacta de forma privada. No hay pago en línea: el trato se cierra directamente con él.",
  },
  {
    q: "¿Cómo contrato un mural?",
    a: "En «Murales y servicios» elige al artista, revisa su precio por hora y envía tu solicitud con los detalles (medidas, ubicación, estilo). Él te contacta para cotizar.",
  },
  {
    q: "¿Cómo publico mi arte?",
    a: "Crea una cuenta y solicita ser artista desde tu panel. Cuando el equipo apruebe tu solicitud podrás subir obras y servicios con precio e imágenes.",
  },
  {
    q: "¿Qué pasa con mis datos de contacto?",
    a: "Tu nombre y teléfono se usan solo para que el artista o el equipo te contacten por esa solicitud. Puedes consultar el aviso de privacidad y eliminar tu cuenta cuando quieras.",
  },
  {
    q: "¿Cuánto tarda en contactarme el artista?",
    a: "Depende de cada artista. Puedes ver el estado de tu solicitud (pendiente, contactado, completado) desde tu cuenta, y cancelarla mientras siga pendiente.",
  },
  {
    q: "¿La plataforma cobra comisión?",
    a: "La plataforma solo conecta a compradores y artistas. El precio y el pago se acuerdan directamente entre las dos partes.",
  },
];

export default async function HomePage() {
  const [featuredWorks, featuredServices, featuredArtists] = await Promise.all([
    getFeaturedArtworks(3),
    getFeaturedServices(3),
    getFeaturedArtists(4),
  ]);

  const heroImages = featuredWorks.filter((w) => !!w.image_url).slice(0, 3);
  const whatsapp = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "").replace(/\D/g, "");
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Galería Viva",
    url: siteUrl,
    inLanguage: "es-MX",
  };

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader hasArtists={featuredArtists.length > 0} />

      <main className="flex-1">
        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden bg-hero pb-20 pt-32 text-white lg:pb-28 lg:pt-40">
          <div className="grain absolute inset-0" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="mb-4 text-sm font-medium uppercase tracking-widest text-accent">
                Arte original · Murales a medida
              </p>
              <h1 className="font-serif text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Arte original y murales,
                <br />
                <span className="text-gradient">directo del artista</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
                Compra una obra o contrata a un artista para tu mural. Dejas tu contacto y
                el artista te escribe. Sin intermediarios.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/gallery"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-8 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
                >
                  Explorar obras
                </Link>
                <Link
                  href="/#servicios"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 px-8 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Contratar mural
                </Link>
              </div>
            </div>

            <div aria-hidden={heroImages.length === 0}>
              {heroImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {heroImages.map((w, i) => (
                    <Link
                      key={w.id}
                      href={`/artwork/${w.id}`}
                      className={`relative overflow-hidden rounded-2xl border border-white/10 ${
                        i === 1 ? "mt-8 aspect-[3/5]" : "aspect-[3/5]"
                      }`}
                    >
                      <Image
                        src={w.image_url as string}
                        alt={w.title}
                        fill
                        priority={i === 0}
                        sizes="(max-width: 1024px) 30vw, 18vw"
                        className="object-cover"
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-accent/20 via-white/5 to-transparent p-8 text-center text-sm text-white/60">
                  Las obras de nuestros artistas aparecerán aquí.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── CÓMO FUNCIONA (franja compacta) ─── */}
        <section
          id="como-funciona"
          aria-labelledby="como-funciona-h"
          className="border-b border-border bg-card"
        >
          <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
            <h2 id="como-funciona-h" className="sr-only">
              Cómo funciona
            </h2>
            <ol className="grid gap-8 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 font-serif text-lg font-semibold text-accent">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium">
                      {step.href ? (
                        <Link href={step.href} className="hover:text-accent">
                          {step.title}
                        </Link>
                      ) : (
                        step.title
                      )}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Obras */}
        <section id="obras" className="py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-sm font-medium uppercase tracking-widest text-accent">
                  Colección
                </p>
                <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
                  Obras destacadas
                </h2>
              </div>
              <Link
                href="/gallery"
                className="text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                Ver todas →
              </Link>
            </div>

            {featuredWorks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-16 text-center">
                <p className="text-sm text-muted">
                  Pronto habrá obras aquí. ¿Eres artista?{" "}
                  <Link href="/register" className="font-medium text-accent underline">
                    Únete
                  </Link>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {featuredWorks.map((work) => (
                  <ArtworkCard key={work.id} artwork={work} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Servicios */}
        <section id="servicios" className="bg-accent-soft/40 py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-14 max-w-2xl">
              <p className="mb-2 text-sm font-medium uppercase tracking-widest text-accent">
                Servicios
              </p>
              <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
                Murales y proyectos a medida
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Contrata artistas por hora. Ideal para locales, hogares y oficinas.
              </p>
            </div>

            {featuredServices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
                <p className="text-sm text-muted">
                  Aún no hay servicios publicados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featuredServices.map((svc) => (
                  <ServiceCard key={svc.id} service={svc} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── ARTISTAS DESTACADOS (solo con datos reales) ─── */}
        {featuredArtists.length > 0 && (
          <section id="artistas" className="py-24 lg:py-28">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mb-10">
                <p className="mb-2 text-sm font-medium uppercase tracking-widest text-accent">
                  Artistas
                </p>
                <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
                  Quiénes están en la galería
                </h2>
              </div>
              <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featuredArtists.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/a/${a.id}`}
                      className="card-lift flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5"
                    >
                      <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-accent/15 font-serif text-xl text-accent">
                        {a.avatar_url ? (
                          <Image
                            src={a.avatar_url}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          (a.full_name || "A").charAt(0).toUpperCase()
                        )}
                      </span>
                      <span className="font-medium">{a.full_name || "Artista"}</span>
                      {a.bio && (
                        <span className="line-clamp-3 text-sm text-muted">{a.bio}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ─── PARA ARTISTAS (compacta) ─── */}
        <section
          aria-labelledby="para-artistas-h"
          className="relative overflow-hidden bg-hero py-16 text-white lg:py-20"
        >
          <div className="grain absolute inset-0" />
          <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-2xl">
              <p className="mb-3 text-sm font-medium uppercase tracking-widest text-accent">
                ¿Eres artista?
              </p>
              <h2
                id="para-artistas-h"
                className="font-serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
              >
                Publica tu trabajo y recibe solicitudes directas
              </h2>
              <ul className="mt-6 space-y-2 text-sm text-white/80">
                <li>• Sube obras y servicios con tus propios precios.</li>
                <li>• Recibe el nombre y teléfono del cliente interesado.</li>
                <li>• Tú cierras el trato directamente con el cliente.</li>
              </ul>
            </div>
            <Link
              href="/become-artist"
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-accent px-8 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
            >
              Solicitar ser artista
            </Link>
          </div>
        </section>

        {/* ─── PREGUNTAS FRECUENTES ─── */}
        <section id="faq" aria-labelledby="faq-h" className="py-24">
          <div className="mx-auto max-w-3xl px-6">
            <h2
              id="faq-h"
              className="text-center font-serif text-3xl font-medium tracking-tight"
            >
              Preguntas frecuentes
            </h2>
            <div className="mt-12 divide-y divide-border rounded-2xl border border-border bg-card">
              {FAQ.map((item) => (
                <details key={item.q} className="group px-6 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="text-accent transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <div className="flex flex-col justify-between gap-8 md:flex-row">
            <div>
              <p className="font-serif text-xl font-semibold">
                Galería<span className="text-accent">Viva</span>
              </p>
              <p className="mt-2 max-w-xs text-sm text-muted">
                Arte original y murales a medida. Conectamos artistas independientes con
                clientes que valoran lo auténtico.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-4">
              <div>
                <p className="mb-3 font-medium">Explorar</p>
                <ul className="space-y-2 text-muted">
                  <li>
                    <Link href="/gallery" className="hover:text-foreground">
                      Catálogo
                    </Link>
                  </li>
                  <li>
                    <Link href="/#servicios" className="hover:text-foreground">
                      Murales
                    </Link>
                  </li>
                  <li>
                    <Link href="/#faq" className="hover:text-foreground">
                      Preguntas
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="mb-3 font-medium">Cuenta</p>
                <ul className="space-y-2 text-muted">
                  <li>
                    <Link href="/login" className="hover:text-foreground">
                      Entrar
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" className="hover:text-foreground">
                      Crear cuenta
                    </Link>
                  </li>
                  <li>
                    <Link href="/become-artist" className="hover:text-foreground">
                      Soy artista
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="mb-3 font-medium">Legal</p>
                <ul className="space-y-2 text-muted">
                  <li>
                    <Link href="/privacy" className="hover:text-foreground">
                      Privacidad
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="hover:text-foreground">
                      Términos
                    </Link>
                  </li>
                </ul>
              </div>
              {(whatsapp || contactEmail) && (
                <div>
                  <p className="mb-3 font-medium">Contacto</p>
                  <ul className="space-y-2 text-muted">
                    {whatsapp && (
                      <li>
                        <a
                          href={`https://wa.me/${whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-foreground"
                        >
                          WhatsApp
                        </a>
                      </li>
                    )}
                    {contactEmail && (
                      <li>
                        <a href={`mailto:${contactEmail}`} className="hover:text-foreground">
                          {contactEmail}
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="mt-10 border-t border-border pt-6 text-xs text-muted">
            <p>© {new Date().getFullYear()} Galería Viva</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
