import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Avatar from "@/components/Avatar";
import PostFeed from "@/components/PostFeed";
import SubscribeButton, { type SubState } from "@/components/SubscribeButton";
import TipButton from "@/components/TipButton";
import ReportButton from "@/components/ReportButton";
import CheckoutNotice from "@/components/CheckoutNotice";
import { createClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/data/creators";
import { categoryLabel, USERNAME_REGEX } from "@/lib/constants";
import type { FeedPost, PublicCreator } from "@/types";

type Params = Promise<{ username: string }>;

async function loadCreator(username: string): Promise<PublicCreator | null> {
  if (!USERNAME_REGEX.test(username)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("public_creators").select("*").eq("username", username).maybeSingle();
  return (data as PublicCreator | null) ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  const c = await loadCreator(username);
  if (!c) return { title: "Creador no encontrado" };
  return {
    title: `${c.display_name || c.username} (@${c.username})`,
    description: c.bio ?? `Suscríbete a ${c.display_name || c.username} en Aura`,
    robots: { index: !c.is_nsfw, follow: true },
  };
}

export default async function CreatorPage({ params }: { params: Params }) {
  const { username } = await params;
  const creator = await loadCreator(username);
  if (!creator) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [currency, feedRes, subRes] = await Promise.all([
    getCurrency(),
    supabase.rpc("get_feed", { p_creator: creator.id, p_limit: 12 }),
    user
      ? supabase
          .from("subscriptions")
          .select("status, provider, cancel_at_period_end, current_period_end")
          .eq("fan_id", user.id)
          .eq("creator_id", creator.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const posts = (feedRes.data as FeedPost[] | null) ?? [];
  const sub = (subRes.data as SubState | null) ?? null;
  const hasAccess =
    !!sub && ["active", "canceled"].includes(sub.status) && new Date(sub.current_period_end).getTime() > Date.now();
  const ctx = { id: creator.id, username: creator.username, price_cents: creator.price_cents, sub };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="relative h-40 bg-accent-soft sm:h-56">
          {creator.banner_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creator.banner_url} alt="" className="h-full w-full object-cover" />
          )}
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[320px_1fr]">
          <aside className="-mt-12 space-y-4 lg:-mt-16">
            <Avatar
              url={creator.avatar_url}
              name={creator.display_name || creator.username}
              size={104}
              className="border-4 border-background"
            />
            <div>
              <h1 className="font-serif text-3xl font-medium">{creator.display_name || creator.username}</h1>
              <p className="text-sm text-muted">@{creator.username}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5">{categoryLabel(creator.category)}</span>
                {creator.is_nsfw && <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-accent">+18</span>}
                <span className="rounded-full bg-white/10 px-2.5 py-0.5">{creator.post_count} publicaciones</span>
              </div>
            </div>
            {creator.bio && <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{creator.bio}</p>}

            <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
              <SubscribeButton creator={ctx} viewerId={user?.id ?? null} sub={sub} currency={currency} />
              <TipButton creatorId={creator.id} username={creator.username} viewerId={user?.id ?? null} currency={currency} />
              {hasAccess && user && user.id !== creator.id && (
                <Link
                  href={`/messages/${creator.id}`}
                  className="inline-flex h-10 w-full items-center justify-center rounded-full border border-border text-sm font-medium hover:border-accent hover:text-accent"
                >
                  Enviar mensaje
                </Link>
              )}
            </div>
            {user?.id !== creator.id && (
              <div>
                <ReportButton targetType="creator" targetId={creator.id} viewerId={user?.id ?? null} label="Reportar perfil" />
              </div>
            )}
          </aside>

          <section aria-label="Publicaciones" className="pt-6 lg:pt-8">
            <Suspense fallback={null}>
              <CheckoutNotice />
            </Suspense>
            <PostFeed
              initial={posts}
              viewerId={user?.id ?? null}
              creatorId={creator.id}
              creator={ctx}
              currency={currency}
              emptyMessage="Este creador aún no ha publicado."
            />
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
