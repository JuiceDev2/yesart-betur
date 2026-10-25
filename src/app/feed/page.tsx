import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PostFeed from "@/components/PostFeed";
import CreatorCard from "@/components/CreatorCard";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCurrency, getFeaturedCreators } from "@/lib/data/creators";
import type { FeedPost } from "@/types";

export const metadata: Metadata = { title: "Mi feed", robots: { index: false } };

export default async function FeedPage() {
  const profile = await requireAuth();
  const supabase = await createClient();
  const [{ data }, currency] = await Promise.all([
    supabase.rpc("get_feed", { p_home: true, p_limit: 12 }),
    getCurrency(),
  ]);
  const posts = (data as FeedPost[] | null) ?? [];
  const suggestions = posts.length === 0 ? await getFeaturedCreators(4) : [];

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="font-serif text-3xl font-medium">Mi feed</h1>
        <p className="mt-1 text-sm text-muted">Lo último de los creadores que sigues.</p>
        <div className="mt-6">
          <PostFeed
            initial={posts}
            viewerId={profile.id}
            home
            currency={currency}
            emptyMessage="Tu feed está vacío. Sigue o suscríbete a un creador para ver su contenido aquí."
          />
        </div>
        {suggestions.length > 0 && (
          <section className="mt-10" aria-label="Sugeridos">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="font-serif text-xl font-medium">Creadores para ti</h2>
              <Link href="/explore" className="text-sm text-accent hover:underline">Ver más →</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {suggestions.map((c) => (
                <CreatorCard key={c.id} c={c} currency={currency} />
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
