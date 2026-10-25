"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, House, LayoutDashboard, MessageCircle, Shield, User } from "lucide-react";

const ICONS = {
  explore: Compass,
  feed: House,
  messages: MessageCircle,
  subscriptions: Heart,
  studio: LayoutDashboard,
  admin: Shield,
  settings: User,
} as const;

export interface MobileNavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

/**
 * Barra inferior para móvil/tablet vertical (< lg). Respeta el área segura de iOS
 * (barra de inicio) y se oculta dentro de una conversación para no tapar el campo de texto.
 * El `data-mobile-nav` hace que globals.css reserve espacio al final de la página.
 */
export default function MobileNav({ items }: { items: MobileNavItem[] }) {
  const pathname = usePathname();
  if (/^\/messages\/[^/]+/.test(pathname)) return null;

  return (
    <nav
      aria-label="Navegación móvil"
      data-mobile-nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        {items.map(({ href, label, icon, badge }) => {
          const Icon = ICONS[icon];
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-[3.75rem] flex-col items-center justify-center gap-0.5 px-1 text-[11px] transition-colors ${
                  active ? "text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
                  {badge ? (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-ink">
                      <span aria-hidden="true">{badge > 9 ? "9+" : badge}</span>
                      <span className="sr-only">{badge} sin leer</span>
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
