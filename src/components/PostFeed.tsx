"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PostCard, { type CreatorCtx } from "@/components/PostCard";
import type { FeedPost } from "@/types";

const PAGE = 12;

export default function PostFeed({
  initial,
  viewerId,
  creatorId = null,
  home = false,
  creator = null,
  currency = "MXN",
  emptyMessage = "Todavía no hay publicaciones.",
}: {
  initial: FeedPost[];
  viewerId: string | null;
  creatorId?: string | null;
  home?: boolean;
  creator?: CreatorCtx | null;
  currency?: string;
  emptyMessage?: string;
}) {
  const [posts, setPosts] = useState<FeedPost[]>(initial);
  const [done, setDone] = useState(initial.length < PAGE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    const last = posts[posts.length - 1];
    if (!last) return;
    setLoading(true);
    setError(null);
    const { data, error } = await createClient().rpc("get_feed", {
      p_creator: creatorId,
      p_home: home,
      p_before: last.published_at,
      p_limit: PAGE,
    });
    setLoading(false);
    if (error) {
      setError("No se pudieron cargar más publicaciones");
      return;
    }
    const rows = (data as FeedPost[] | null) ?? [];
    setPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...rows.filter((r) => !seen.has(r.id))];
    });
    if (rows.length < PAGE) setDone(true);
  }

  if (posts.length === 0) {
    return <p className="rounded-3xl border border-dashed border-border py-16 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-5">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} viewerId={viewerId} creator={creator} currency={currency} />
      ))}
      {!done && (
        <div className="text-center">
          <button
            type="button"
            onClick={more}
            disabled={loading}
            className="h-10 rounded-full border border-border px-6 text-sm font-medium hover:border-accent disabled:opacity-60"
          >
            {loading ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-center text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
