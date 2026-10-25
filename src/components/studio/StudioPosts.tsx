"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Empty, Loading, Pill } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import { timeAgo } from "@/lib/utils";
import { VISIBILITY_LABEL } from "@/lib/constants";
import type { FeedPost } from "@/types";

const PAGE = 15;

export default function StudioPosts({ creatorId, currency, refreshKey }: { creatorId: string; currency: string; refreshKey: number }) {
  const [rows, setRows] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (before: string | null, append: boolean) => {
      setLoading(true);
      const { data, error } = await createClient().rpc("get_feed", {
        p_creator: creatorId,
        p_before: before,
        p_limit: PAGE,
      });
      setLoading(false);
      if (error) {
        setError("No se pudieron cargar tus publicaciones");
        return;
      }
      const list = (data as FeedPost[] | null) ?? [];
      setRows((prev) => (append ? [...prev, ...list.filter((l) => !prev.some((p) => p.id === l.id))] : list));
      setDone(list.length < PAGE);
    },
    [creatorId]
  );

  useEffect(() => {
    void load(null, false);
  }, [load, refreshKey]);

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta publicación? No se puede deshacer.")) return;
    const supabase = createClient();
    const { data: media } = await supabase.from("post_media").select("path").eq("post_id", id);
    const paths = (media ?? []).map((m) => m.path as string);
    if (paths.length) await supabase.storage.from("media").remove(paths);
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      setError("No se pudo eliminar");
      return;
    }
    setRows((r) => r.filter((p) => p.id !== id));
  }

  if (loading && rows.length === 0) return <Loading />;
  if (rows.length === 0) return <Empty>Aún no has publicado nada.</Empty>;

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-300">
          {error}
        </p>
      )}
      <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
        {rows.map((p) => {
          const scheduled = new Date(p.published_at).getTime() > Date.now();
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{p.body || p.teaser || "(solo archivos)"}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {scheduled ? `Programada · ${new Date(p.published_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}` : timeAgo(p.published_at)}
                  {" · "}♥ {p.like_count} · 💬 {p.comment_count}
                  {p.image_count + p.video_count > 0 ? ` · ${p.image_count + p.video_count} archivo(s)` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone="gray">
                  {VISIBILITY_LABEL[p.visibility]}
                  {p.visibility === "ppv" && p.price_cents ? ` ${formatMoney(p.price_cents, currency)}` : ""}
                </Pill>
                {p.is_nsfw && <Pill tone="pink">+18</Pill>}
                {scheduled && <Pill tone="blue">Programada</Pill>}
                {p.is_hidden && <Pill tone="red">Oculta por moderación</Pill>}
              </div>
              <Link href={`/post/${p.id}`} className="text-xs text-accent hover:underline">
                Ver
              </Link>
              <button type="button" onClick={() => remove(p.id)} className="text-xs text-muted hover:text-red-300">
                Eliminar
              </button>
            </li>
          );
        })}
      </ul>
      {!done && (
        <div className="mt-4 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => load(rows[rows.length - 1]?.published_at ?? null, true)}
            className="h-9 rounded-full border border-border px-5 text-sm hover:border-accent disabled:opacity-60"
          >
            {loading ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      )}
    </>
  );
}
