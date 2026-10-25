import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import LogoutButton from "@/components/LogoutButton";
import Logo from "@/components/Logo";

const linkCls = "rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-foreground";

/**
 * Cabecera única de la app (componente de servidor). Muestra enlaces según el rol y
 * un menú móvil con <details>: funciona sin JavaScript y es accesible con teclado.
 */
export default async function SiteHeader() {
  const profile = await getCurrentProfile();
  let unread = 0;
  if (profile) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("unread_count");
    unread = typeof data === "number" ? data : 0;
  }

  const links: Array<{ href: string; label: string }> = [{ href: "/explore", label: "Explorar" }];
  if (profile) {
    links.push({ href: "/feed", label: "Mi feed" });
    links.push({ href: "/messages", label: unread > 0 ? `Mensajes (${unread})` : "Mensajes" });
    links.push({ href: "/subscriptions", label: "Suscripciones" });
    if (profile.role === "creator") links.push({ href: "/studio", label: "Estudio" });
    if (profile.role === "admin") links.push({ href: "/admin", label: "Admin" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex" aria-label="Aura, inicio">
          <Logo />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkCls}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {profile ? (
            <>
              <Link
                href="/settings"
                className="hidden items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-sm sm:flex"
              >
                <Avatar url={profile.avatar_url} name={profile.display_name || profile.username} size={28} />
                <span className="max-w-28 truncate">@{profile.username}</span>
              </Link>
              <LogoutButton className="hidden h-9 rounded-full px-3 text-sm text-muted hover:text-foreground lg:block" />
            </>
          ) : (
            <>
              <Link href="/login" className="hidden h-9 items-center rounded-full px-4 text-sm text-muted hover:text-foreground sm:inline-flex">
                Entrar
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
              >
                Crear cuenta
              </Link>
            </>
          )}

          <details className="group relative lg:hidden">
            <summary
              aria-label="Abrir menú"
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-border [&::-webkit-details-marker]:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </summary>
            <div className="absolute right-0 top-12 w-64 rounded-2xl border border-border bg-card p-3 shadow-2xl">
              <ul className="space-y-1 text-sm">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="block rounded-lg px-3 py-2 hover:bg-accent-soft">
                      {l.label}
                    </Link>
                  </li>
                ))}
                {profile ? (
                  <>
                    <li className="border-t border-border pt-1">
                      <Link href="/settings" className="block rounded-lg px-3 py-2 hover:bg-accent-soft">
                        Ajustes
                      </Link>
                    </li>
                    {profile.role === "fan" && (
                      <li>
                        <Link href="/become-creator" className="block rounded-lg px-3 py-2 text-accent hover:bg-accent-soft">
                          Quiero ser creador
                        </Link>
                      </li>
                    )}
                    <li>
                      <LogoutButton className="block w-full rounded-lg px-3 py-2 text-left hover:bg-accent-soft" />
                    </li>
                  </>
                ) : (
                  <li className="border-t border-border pt-1">
                    <Link href="/login" className="block rounded-lg px-3 py-2 hover:bg-accent-soft">
                      Entrar
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
