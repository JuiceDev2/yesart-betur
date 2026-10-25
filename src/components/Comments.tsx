"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import ReportButton from "@/components/ReportButton";
import { timeAgo } from "@/lib/utils";
import type { CommentRow } from "@/types";

export default function Comments({ postId, viewerId }: { postId: string; viewerId: string | null }) {
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data } = await createClient().rpc("get_comments", { p_post: postId, p_limit: 30 });
    setRows(((data as CommentRow[] | null) ?? []).slice().reverse());
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !viewerId) return;
    setSending(true);
    setError(null);
    const { error } = await createClient().from("comments").insert({ post_id: postId, user_id: viewerId, body });
    setSending(false);
    if (error) {
      setError(error.message.includes("Demasiadas") ? "Vas muy rápido. Espera un momento." : "No se pudo publicar el comentario");
      return;
    }
    setText("");
    await load();
  }

  async function remove(id: string) {
    await createClient().from("comments").delete().eq("id", id);
    await load();
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      {loading ? (
        <p className="text-xs text-muted" role="status">Cargando comentarios…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted">Sé la primera persona en comentar.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id} className="flex gap-2">
              <Avatar url={c.avatar_url} name={c.display_name || c.username} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-medium">@{c.username}</span>{" "}
                  <span className="text-muted">{timeAgo(c.created_at)}</span>
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
                <div className="mt-0.5 flex gap-3">
                  {c.can_delete && (
                    <button type="button" onClick={() => remove(c.id)} className="text-xs text-muted hover:text-red-300">
                      Eliminar
                    </button>
                  )}
                  {!c.mine && <ReportButton targetType="comment" targetId={c.id} viewerId={viewerId} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewerId ? (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input
            aria-label="Escribe un comentario"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder="Escribe un comentario…"
            className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted">Inicia sesión para comentar.</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
