"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types";

interface AppHeaderProps {
  profile: Profile;
  label?: string;
}

export default function AppHeader({ profile, label }: AppHeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const homeLink =
    profile.role === "admin"
      ? "/admin"
      : profile.role === "artist"
        ? "/artist"
        : "/dashboard";

  return (
    <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-md z-40">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href={homeLink} className="font-serif text-xl font-semibold">
            Yesart<span className="text-accent">-betur</span>
          </Link>
          {label && (
            <span className="hidden sm:inline text-sm text-muted border-l border-border pl-6">
              {label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/gallery"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Catálogo
          </Link>
          <span className="text-sm text-muted hidden sm:inline">
            {profile.full_name || profile.email}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
