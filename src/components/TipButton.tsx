"use client";

import Link from "next/link";
import { useState } from "react";
import CheckoutButton from "@/components/CheckoutButton";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { MAX_TIP_CENTS, MIN_TIP_CENTS } from "@/lib/constants";

const PRESETS = [5000, 10000, 20000];

export default function TipButton({
  creatorId,
  username,
  viewerId,
  currency = "MXN",
}: {
  creatorId: string;
  username: string;
  viewerId: string | null;
  currency?: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("100");
  const [message, setMessage] = useState("");

  if (viewerId === creatorId) return null;
  if (!viewerId) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/c/${username}`)}`}
        className="inline-flex h-10 w-full items-center justify-center rounded-full border border-border px-5 text-sm font-medium hover:border-accent hover:text-accent"
      >
        Enviar propina
      </Link>
    );
  }

  const cents = parseMoneyToCents(amount);
  const valid = cents !== null && cents >= MIN_TIP_CENTS && cents <= MAX_TIP_CENTS;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-10 w-full items-center justify-center rounded-full border border-border px-5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
      >
        Enviar propina
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p / 100))}
                className="h-9 flex-1 rounded-full border border-border text-xs font-medium hover:border-accent"
              >
                {formatMoney(p, currency)}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor={`tip-${creatorId}`} className="mb-1 block text-xs text-muted">
              Otro importe (mínimo {formatMoney(MIN_TIP_CENTS, currency)})
            </label>
            <input
              id={`tip-${creatorId}`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label htmlFor={`tipmsg-${creatorId}`} className="mb-1 block text-xs text-muted">
              Mensaje (opcional)
            </label>
            <input
              id={`tipmsg-${creatorId}`}
              maxLength={200}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          {valid ? (
            <CheckoutButton
              body={{ kind: "tip", creatorId, amountCents: cents, message: message || null }}
              className="h-10 w-full rounded-full bg-accent text-sm font-semibold text-accent-ink hover:opacity-90"
            >
              Enviar {formatMoney(cents, currency)}
            </CheckoutButton>
          ) : (
            <p className="text-xs text-amber-200">
              Escribe un importe entre {formatMoney(MIN_TIP_CENTS, currency)} y {formatMoney(MAX_TIP_CENTS, currency)}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
