"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signPaths } from "@/lib/media";
import Avatar from "@/components/Avatar";
import CheckoutButton from "@/components/CheckoutButton";
import Comments from "@/components/Comments";
import ReportButton from "@/components/ReportButton";
import SubscribeButton, { type SubState } from "@/components/SubscribeButton";
import { formatMoney } from "@/lib/money";
import { timeAgo } from "@/lib/utils";
import { VISIBILITY_LABEL } from "@/lib/constants";
import type { FeedPost, PostMedia } from "@/types";

export interface CreatorCtx {
  id: string;
  username: string;
  price_cents: number;
  sub: SubState | null;
}

function mediaSummary(p: FeedPost): string {
  const parts: string[] = [];
  if (p.image_count) parts.push(`${p.image_count} foto${p.image_count > 1 ? "s" : ""}`);
  if (p.video_count) parts.push(`${p.video_count} video${p.video_count > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

function LockPanel({
  post,
  viewerId,
  creator,
  currency,
}: {
  post: FeedPost;
  viewerId: string | null;
  creator: CreatorCtx | null;
  currency: string;
}) {
  const summary = mediaSummary(post);
  const next = encodeURIComponent(`/c/${post.username}`);

  let action: React.ReactNode;
  if (!viewerId) {
    action = (
      <Link
        href={`/login?next=${next}`}
        className="inline-flex h-10 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink"
      >
        Inicia sesión para ver
      </Link>
    );
  } else if (post.visibility === "ppv" && post.price_cents) {
    action = (
      <CheckoutButton
        body={{ kind: "ppv", creatorId: post.creator_id, postId: post.id }}
        className="inline-flex h-10 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink hover:opacity-90"
      >
        Desbloquear por {formatMoney(post.price_cents, currency)}
      </CheckoutButton>
    );
  } else if (post.visibility === "free") {
    action = (
      <Link href="/settings" className="text-sm text-accent underline">
        Confirma tu mayoría de edad para ver este contenido
      </Link>
    );
  } else if (creator) {
    action = (
      <div className="w-64 max-w-full">
        <SubscribeButton creator={creator} viewerId={viewerId} sub={creator.sub} currency={currency} />
      </div>
    );
  } else {
    action = (
      <Link href={`/c/${post.username}`} className="text-sm text-accent underline">
        Ver el perfil para suscribirte
      </Link>
    );
  }

  return (
    <div className="locked-pattern mt-3 flex flex-col items-center gap-3 rounded-2xl border border-border px-4 py-10 text-center">
      <span aria-hidden="true" className="text-3xl">🔒</span>
      <p className="text-sm font-medium">
        {post.visibility === "ppv" ? "Contenido de pago" : post.visibility === "subscribers" ? "Solo para suscriptores" : "Contenido para adultos"}
      </p>
      {summary && <p className="text-xs text-muted">{summary}</p>}
      {action}
    </div>
  );
}

function MediaGrid({ postId }: { postId: string }) {
  const [items, setItems] = useState<Array<PostMedia & { url?: string }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await createClient()
        .from("post_media")
        .select("id, post_id, path, kind, position")
        .eq("post_id", postId)
        .order("position", { ascending: true });
      const rows = (data as PostMedia[] | null) ?? [];
      const urls = await signPaths(rows.map((r) => r.path));
      if (!cancelled) setItems(rows.map((r) => ({ ...r, url: urls[r.path] })));
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (items === null) return <div className="mt-3 h-48 animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  if (items.length === 0) return null;

  return (
    <div className={`mt-3 grid gap-2 ${items.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {items.map((m) =>
        !m.url ? null : m.kind === "video" ? (
          <video
            key={m.id}
            src={m.url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[70vh] w-full rounded-2xl bg-black"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={m.id}
            src={m.url}
            alt="Imagen de la publicación"
            loading="lazy"
            className="max-h-[70vh] w-full rounded-2xl object-cover"
          />
        )
      )}
    </div>
  );
}

export default function PostCard({
  post,
  viewerId,
  creator = null,
  currency = "MXN",
  defaultOpenComments = false,
}: {
  post: FeedPost;
  viewerId: string | null;
  creator?: CreatorCtx | null;
  currency?: string;
  defaultOpenComments?: boolean;
}) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.like_count);
  const [showComments, setShowComments] = useState(defaultOpenComments);
  const isOwner = viewerId === post.creator_id;
  const scheduled = new Date(post.published_at).getTime() > Date.now();
  const hasMedia = post.image_count + post.video_count > 0;

  async function toggleLike() {
    if (!viewerId || post.locked) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    const supabase = createClient();
    const { error } = next
      ? await supabase.from("likes").insert({ post_id: post.id, user_id: viewerId })
      : await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", viewerId);
    if (error && error.code !== "23505") {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-4 sm:p-5" aria-label={`Publicación de ${post.display_name}`}>
      <header className="flex items-center gap-3">
        <Link href={`/c/${post.username}`} aria-label={`Perfil de ${post.display_name}`}>
          <Avatar url={post.avatar_url} name={post.display_name || post.username} size={44} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/c/${post.username}`} className="block truncate text-sm font-semibold hover:text-accent">
            {post.display_name || post.username}
          </Link>
          <p className="text-xs text-muted">
            @{post.username} ·{" "}
            <Link href={`/post/${post.id}`} className="hover:text-foreground">
              {scheduled ? `Programada: ${new Date(post.published_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}` : timeAgo(post.published_at)}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5 text-[11px]">
          <span className="rounded-full bg-white/10 px-2 py-0.5">
            {VISIBILITY_LABEL[post.visibility]}
            {post.visibility === "ppv" && post.price_cents ? ` · ${formatMoney(post.price_cents, currency)}` : ""}
          </span>
          {post.is_nsfw && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-accent">+18</span>}
          {post.is_hidden && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-300">Oculta</span>}
        </div>
      </header>

      {post.locked ? (
        <>
          {post.teaser && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">{post.teaser}</p>}
          <LockPanel post={post} viewerId={viewerId} creator={creator} currency={currency} />
        </>
      ) : (
        <>
          {post.body && <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{post.body}</p>}
          {hasMedia && <MediaGrid postId={post.id} />}
        </>
      )}

      <footer className="mt-4 flex items-center gap-5 text-sm">
        <button
          type="button"
          onClick={toggleLike}
          disabled={!viewerId || post.locked}
          aria-pressed={liked}
          aria-label={liked ? "Quitar me gusta" : "Me gusta"}
          className={`flex items-center gap-1.5 transition-colors disabled:opacity-50 ${liked ? "text-accent" : "text-muted hover:text-foreground"}`}
        >
          <span aria-hidden="true">{liked ? "♥" : "♡"}</span> {likes}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          disabled={post.locked}
          aria-expanded={showComments}
          className="flex items-center gap-1.5 text-muted transition-colors hover:text-foreground disabled:opacity-50"
        >
          <span aria-hidden="true">💬</span> {post.comment_count}
        </button>
        {!isOwner && (
          <span className="ml-auto">
            <ReportButton targetType="post" targetId={post.id} viewerId={viewerId} />
          </span>
        )}
      </footer>

      {showComments && !post.locked && <Comments postId={post.id} viewerId={viewerId} />}
    </article>
  );
}
