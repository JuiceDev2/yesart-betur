"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { Pill } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type { SubscriptionRow } from "@/types";

function statusOf(s: SubscriptionRow): { tone: "green" | "yellow" | "red" | "gray"; label: string } {
  const live = new Date(s.current_period_end).getTime() > Date.now();
  if (s.status === "active" && live) return { tone: "green", label: s.provider === "free" ? "Siguiendo" : "Activa" };
  if (s.status === "canceled" && live) return { tone: "yellow", label: "Cancelada · con acceso" };
  if (s.status === "past_due") return { tone: "red", label: "Pago pendiente" };
  return { tone: "gray", label: "Vencida" };
}

export default function SubscriptionsList({ rows, currency }: { rows: SubscriptionRow[]; currency: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancel(creatorId: string) {
    setBusy(creatorId);
    setError(null);
    const res = await fetch("/api/subscriptions/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId }),
    });
    setBusy(null);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "No se pudo cancelar");
      return;
    }
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-border py-16 text-center text-sm text-muted">
        Aún no sigues a ningún creador. <Link href="/explore" className="text-accent underline">Explora creadores</Link>
      </p>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {rows.map((s) => {
          const st = statusOf(s);
          const cancellable = st.label === "Activa" || st.label === "Siguiendo";
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <Avatar url={s.avatar_url} name={s.display_name || s.username} size={48} />
              <div className="min-w-0 flex-1">
                <Link href={`/c/${s.username}`} className="block truncate font-medium hover:text-accent">
                  {s.display_name || s.username}
                </Link>
                <p className="text-xs text-muted">
                  @{s.username} ·{" "}
                  {s.provider === "free"
                    ? "Gratis"
                    : `${formatMoney(s.price_cents, currency)}/mes · ${
                        s.status === "active" ? "renueva" : "termina"
                      } el ${formatDate(s.current_period_end)}`}
                </p>
              </div>
              <Pill tone={st.tone}>{st.label}</Pill>
              {cancellable && (
                <button
                  type="button"
                  onClick={() => cancel(s.creator_id)}
                  disabled={busy === s.creator_id}
                  className="h-9 rounded-full border border-border px-4 text-xs font-medium hover:border-red-400 hover:text-red-300 disabled:opacity-60"
                >
                  {s.provider === "free" ? "Dejar de seguir" : "Cancelar renovación"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
