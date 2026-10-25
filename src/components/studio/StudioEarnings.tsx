"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Empty, Loading, PAGE_SIZE, Pager, Pill } from "@/components/admin/ui";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { formatDateTime } from "@/components/admin/ui";
import type { Balance } from "@/types";

interface Tx {
  id: string;
  kind: string;
  status: string;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  currency: string;
  note: string | null;
  fan_username: string | null;
  created_at: string;
  total: number;
}

interface Payout {
  id: string;
  amount_cents: number;
  currency: string;
  status: "requested" | "paid" | "rejected";
  reference: string | null;
  note: string | null;
  requested_at: string;
}

const KIND: Record<string, string> = {
  subscription: "Suscripción",
  renewal: "Renovación",
  ppv: "Publicación",
  tip: "Propina",
};

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function StudioEarnings() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [b, t, p] = await Promise.all([
      supabase.rpc("creator_balance"),
      supabase.rpc("my_earnings", { p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
      supabase.from("payouts").select("id, amount_cents, currency, status, reference, note, requested_at").order("requested_at", { ascending: false }).limit(20),
    ]);
    const bal = ((b.data as Balance[] | null) ?? [])[0] ?? null;
    setBalance(bal);
    setTxs((t.data as Tx[] | null) ?? []);
    setPayouts((p.data as Payout[] | null) ?? []);
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestPayout(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cents = parseMoneyToCents(amount);
    if (cents === null || cents <= 0) {
      setMsg({ ok: false, text: "Escribe un importe válido" });
      return;
    }
    setBusy(true);
    const { error } = await createClient().rpc("request_payout", { p_amount: cents });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message.replace(/^.*?:\s*/, "") });
      return;
    }
    setMsg({ ok: true, text: "Retiro solicitado. Lo revisaremos y te avisaremos por correo cuando se pague." });
    setAmount("");
    await load();
  }

  if (loading && !balance) return <Loading />;
  const cur = balance?.currency ?? "MXN";
  const total = txs[0]?.total ?? 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Disponible para retirar" value={formatMoney(balance?.available_cents, cur)} />
        <Card
          label="En retención"
          value={formatMoney(balance?.hold_cents, cur)}
          hint="Se libera unos días después de cada cobro (protege contra reembolsos)"
        />
        <Card label="Retiro pendiente" value={formatMoney(balance?.pending_payout_cents, cur)} />
        <Card label="Total ganado (neto)" value={formatMoney(balance?.earned_cents, cur)} hint={`Pagado: ${formatMoney(balance?.paid_out_cents, cur)}`} />
      </div>

      <section aria-labelledby="retiro" className="rounded-3xl border border-border bg-card p-5">
        <h2 id="retiro" className="font-semibold">Solicitar un retiro</h2>
        <p className="mt-1 text-xs text-muted">
          Mínimo {formatMoney(balance?.min_payout_cents, cur)}. Configura tu cuenta de cobro en la pestaña Ajustes.
        </p>
        <form onSubmit={requestPayout} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="Importe a retirar"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Importe (hasta ${formatMoney(balance?.available_cents, cur)})`}
            className="h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="button"
            onClick={() => setAmount(((balance?.available_cents ?? 0) / 100).toFixed(2))}
            className="h-11 rounded-full border border-border px-5 text-sm hover:border-accent"
          >
            Todo
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink disabled:opacity-60"
          >
            {busy ? "Enviando…" : "Solicitar"}
          </button>
        </form>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>
            {msg.text}
          </p>
        )}
        {payouts.length > 0 && (
          <ul className="mt-4 divide-y divide-border text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="font-medium">{formatMoney(p.amount_cents, p.currency)}</span>
                <Pill tone={p.status === "paid" ? "green" : p.status === "rejected" ? "red" : "yellow"}>
                  {p.status === "paid" ? "Pagado" : p.status === "rejected" ? "Rechazado" : "En revisión"}
                </Pill>
                <span className="text-xs text-muted">{formatDateTime(p.requested_at)}</span>
                {p.reference && <span className="text-xs text-muted">Ref. {p.reference}</span>}
                {p.note && <span className="text-xs text-muted">{p.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="movs">
        <h2 id="movs" className="mb-3 font-semibold">Movimientos</h2>
        {txs.length === 0 ? (
          <Empty>Aún no tienes ingresos.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-border bg-card">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">De</th>
                  <th className="px-4 py-3 text-right font-medium">Bruto</th>
                  <th className="px-4 py-3 text-right font-medium">Comisión</th>
                  <th className="px-4 py-3 text-right font-medium">Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {txs.map((t) => (
                  <tr key={t.id} className={t.status === "refunded" ? "text-muted line-through" : ""}>
                    <td className="px-4 py-2.5">{formatDateTime(t.created_at)}</td>
                    <td className="px-4 py-2.5">
                      {KIND[t.kind] ?? t.kind}
                      {t.status === "refunded" && " (reembolsado)"}
                      {t.note && <span className="block max-w-48 truncate text-xs text-muted no-underline">“{t.note}”</span>}
                    </td>
                    <td className="px-4 py-2.5">{t.fan_username ? `@${t.fan_username}` : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{formatMoney(t.gross_cents, t.currency)}</td>
                    <td className="px-4 py-2.5 text-right">{formatMoney(t.fee_cents, t.currency)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatMoney(t.net_cents, t.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} total={total} onChange={setPage} />
      </section>
    </div>
  );
}
