import Link from "next/link";

interface SiteHeaderProps {
  /** Muestra el enlace «Artistas» solo si hay artistas reales que enseñar. */
  hasArtists?: boolean;
}

const LINK = "transition-colors hover:text-foreground";

/**
 * Encabezado público. Es un componente de servidor: el menú móvil usa
 * <details>, así funciona sin JavaScript y es accesible con teclado.
 */
export default function SiteHeader({ hasArtists = false }: SiteHeaderProps) {
  const links = [
    { href: "/gallery", label: "Obras" },
    { href: "/#servicios", label: "Murales y servicios" },
    ...(hasArtists ? [{ href: "/#artistas", label: "Artistas" }] : []),
    { href: "/#como-funciona", label: "Cómo funciona" },
    { href: "/#faq", label: "Preguntas" },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="font-serif text-2xl font-semibold tracking-tight">
          Yesart<span className="text-accent">-betur</span>
        </Link>

        <nav
          aria-label="Principal"
          className="hidden items-center gap-8 text-sm font-medium text-muted lg:flex"
        >
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={LINK}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/become-artist"
            className="hidden text-sm font-medium text-muted transition-colors hover:text-foreground xl:inline-flex"
          >
            ¿Eres artista?
          </Link>
          <Link
            href="/login"
            className="hidden text-sm font-medium text-muted transition-colors hover:text-foreground sm:inline-flex"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Crear cuenta
          </Link>

          <details className="group relative lg:hidden">
            <summary
              aria-label="Abrir menú"
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-border [&::-webkit-details-marker]:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </summary>
            <div className="absolute right-0 top-12 w-64 rounded-2xl border border-border bg-background p-3 shadow-xl">
              <ul className="space-y-1 text-sm">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="block rounded-lg px-3 py-2 hover:bg-accent-soft/50">
                      {l.label}
                    </Link>
                  </li>
                ))}
                <li className="border-t border-border pt-1">
                  <Link href="/login" className="block rounded-lg px-3 py-2 hover:bg-accent-soft/50">
                    Entrar
                  </Link>
                </li>
                <li>
                  <Link
                    href="/become-artist"
                    className="block rounded-lg px-3 py-2 hover:bg-accent-soft/50"
                  >
                    ¿Eres artista?
                  </Link>
                </li>
              </ul>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
