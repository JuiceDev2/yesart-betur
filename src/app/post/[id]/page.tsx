import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PostCard from "@/components/PostCard";
import CheckoutNotice from "@/components/CheckoutNotice";
import { createClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/data/creators";
import { isUuid } from "@/lib/utils";
import type { FeedPost } from "@/types";

export const metadata: Metadata = { title: "Publicación", robots: { index: false, follow: false } };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data }, currency] = await Promise.all([supabase.rpc("get_feed", { p_post: id, p_limit: 1 }), getCurrency()]);
  const post = ((data as FeedPost[] | null) ?? [])[0];
  if (!post) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <Link href={`/c/${post.username}`} className="mb-4 inline-block text-sm text-muted hover:text-foreground">
          ← Perfil de @{post.username}
        </Link>
        <Suspense fallback={null}>
          <CheckoutNotice />
        </Suspense>
        <PostCard post={post} viewerId={user?.id ?? null} currency={currency} defaultOpenComments />
      </main>
      <SiteFooter />
    </div>
  );
}
