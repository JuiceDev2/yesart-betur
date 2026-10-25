"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import type { MessageRow } from "@/types";

export default function Thread({
  meId,
  otherId,
  canReply,
}: {
  meId: string;
  otherId: string;
  canReply: boolean;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at, read_at")
      .or(
        `and(sender_id.eq.${meId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${meId})`
      )
      .order("created_at", { ascending: false })
      .limit(100);
    setMessages(((data as MessageRow[] | null) ?? []).slice().reverse());
    await supabase.rpc("mark_thread_read", { p_other: otherId });
  }, [meId, otherId]);

  useEffect(() => {
    void load();
    // Sondeo ligero cada 8 s, solo con la pestaña visible (sin dependencias de tiempo real)
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const { error } = await createClient().rpc("send_message", { p_to: otherId, p_body: body });
    setSending(false);
    if (error) {
      setError(error.message.includes("Demasiadas") ? "Vas muy rápido. Espera un momento." : error.message);
      return;
    }
    setText("");
    await load();
  }

  return (
    <div className="flex h-[70dvh] max-h-[48rem] min-h-[22rem] flex-col rounded-3xl border border-border bg-card">
      <div className="flex-1 space-y-2 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Mensajes">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">Aún no hay mensajes. Escribe el primero.</p>}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  mine ? "bg-accent text-accent-ink" : "bg-white/10"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-accent-ink/70" : "text-muted"}`}>{timeAgo(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {canReply ? (
        <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
          <input
            aria-label="Escribe un mensaje"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder="Escribe un mensaje…"
            className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="h-11 rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      ) : (
        <p className="border-t border-border p-4 text-center text-xs text-muted">
          Ya no puedes enviar mensajes a esta persona (la suscripción terminó o no está disponible).
        </p>
      )}
      {error && (
        <p role="alert" className="px-4 pb-3 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
