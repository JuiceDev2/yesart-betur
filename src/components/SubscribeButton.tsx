"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import CheckoutButton from "@/components/CheckoutButton";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export interface SubState {
  status: "active" | "past_due" | "canceled" | "expired";
  provider: string;
  cancel_at_period_end: boolean;
  current_period_end: string;
}

const primary =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60";
const secondary =
  "inline-flex h-10 w-full items-center justify-center rounded-full border border-border px-5 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-60";

export default function SubscribeButton({
  creator,
  viewerId,
  sub,
  currency = "MXN",
}: {
  creator: { id: string; username: string; price_cents: number };
  viewerId: string | null;
  sub: SubState | null;
  currency?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!viewerId) {
    return (
      <Link href={`/login?next=${encodeURIComponent(`/c/${creator.username}`)}`} className={primary}>
        {creator.price_cents > 0 ? `Suscribirme · ${formatMoney(creator.price_cents, currency)}/mes` : "Seguir gratis"}
      </Link>
    );
  }
  if (viewerId === creator.id) {
    return (
      <Link href="/studio" className={secondary}>
        Ir a mi estudio
      </Link>
    );
  }

  const hasAccess =
    !!sub && ["active", "canceled"].includes(sub.status) && new Date(sub.current_period_end).getTime() > Date.now();

  async function run(fn: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
    else router.refresh();
  }

  async function follow() {
    await run(async () => {
      const { error } = await createClient().rpc("follow_creator", { p_creator: creator.id });
      return error ? error.message : null;
    });
  }

  async function cancel() {
    await run(async () => {
      const res = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: creator.id }),
      });
      if (res.ok) return null;
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      return json.error ?? "No se pudo cancelar";
    });
  }

  const paidBody = { kind: "subscription" as const, creatorId: creator.id };

  let content: React.ReactNode;
  if (creator.price_cents === 0) {
    content = hasAccess ? (
      <button type="button" onClick={cancel} disabled={busy} className={secondary}>
        ✓ Siguiendo · Dejar de seguir
      </button>
    ) : (
      <button type="button" onClick={follow} disabled={busy} className={primary}>
        Seguir gratis
      </button>
    );
  } else if (hasAccess && sub && !sub.cancel_at_period_end && sub.status === "active") {
    content = (
      <>
        <p className="mb-2 text-center text-sm text-emerald-300">
          ✓ Suscrito · renueva el {formatDate(sub.current_period_end)}
        </p>
        <button type="button" onClick={cancel} disabled={busy} className={secondary}>
          Cancelar renovación
        </button>
      </>
    );
  } else if (hasAccess && sub) {
    content = (
      <>
        <p className="mb-2 text-center text-sm text-amber-200">
          Tu acceso termina el {formatDate(sub.current_period_end)}
        </p>
        <CheckoutButton body={paidBody} className={primary}>
          Volver a suscribirme
        </CheckoutButton>
      </>
    );
  } else {
    content = (
      <CheckoutButton body={paidBody} className={primary}>
        Suscribirme · {formatMoney(creator.price_cents, currency)}/mes
      </CheckoutButton>
    );
  }

  return (
    <div>
      {content}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
