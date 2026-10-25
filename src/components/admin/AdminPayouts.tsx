"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Empty, Loading, PAGE_SIZE, Pager, Pill, formatDateTime } from "./ui";
import { formatMoney } from "@/lib/money";

interface Payout {
  id: string;
  amount_cents: number;
  currency: string;
  status: "requested" | "paid" | "rejected";
  reference: string | null;
  note: string | null;
  requested_at: string;
  account_snapshot: { holder_name?: string; account_ref?: string; bank_name?: string | null } | null;
  creator: { username: string; email: string | null } | { username: string; email: string | null }[] | null;
}

export default function AdminPayouts() {
  const [status, setStatus] = useState<"requested" | "paid" | "rejected">("requested");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Payout[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await createClient()
      .from("payouts")
      .select(
        "id, amount_cents, currency, status, reference, note, requested_at, account_snapshot, creator:profiles!payouts_creator_id_fkey(username, email)",
        { count: "exact" }
      )
      .eq("status", status)
      .order("requested_at", { ascending: status === "requested" })
      .range(from, from + PAGE_SIZE - 1);
    setRows((data as unknown as Payout[] | null) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(p: Payout, st: "paid" | "rejected") {
    setMsg(null);
    const reference = st === "paid" ? prompt("Referencia del pago (clave de rastreo o folio):") : null;
    if (st === "paid" && !reference?.trim()) return;
    const note = st === "rejected" ? prompt("Motivo del rechazo:") : null;
    if (st === "rejected" && !note?.trim()) return;
    const res = await fetch("/api/admin/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutId: p.id, status: st, reference, note }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg(res.ok ? "Retiro actualizado" : (json.error ?? "No se pudo actualizar"));
    await load();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["requested", "paid", "rejected"] as const).map((s) => (
          <button
            key={s}
            aria-pressed={status === s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`h-8 rounded-full px-4 text-xs ${status === s ? "bg-accent font-semibold text-accent-ink" : "border border-border"}`}
          >
            {s === "requested" ? "Por pagar" : s === "paid" ? "Pagados" : "Rechazados"}
          </button>
        ))}
        <a href="/api/admin/transactions-csv" className="ml-auto text-xs text-accent hover:underline">
          Descargar movimientos (CSV)
        </a>
      </div>
      <p className="mb-3 text-xs text-muted">
        Los retiros son manuales: transfiere a la cuenta indicada y registra aquí la referencia del pago.
      </p>
      {msg && <p role="status" className="mb-3 text-sm text-muted">{msg}</p>}
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>No hay retiros en este estado.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => {
            const c = Array.isArray(p.creator) ? p.creator[0] : p.creator;
            const a = p.account_snapshot;
            return (
              <li key={p.id} className="rounded-3xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg font-semibold">{formatMoney(p.amount_cents, p.currency)}</span>
                  <span className="text-sm">@{c?.username ?? "—"}</span>
                  <Pill tone={p.status === "paid" ? "green" : p.status === "rejected" ? "red" : "yellow"}>
                    {p.status === "paid" ? "Pagado" : p.status === "rejected" ? "Rechazado" : "Por pagar"}
                  </Pill>
                  <span className="ml-auto text-xs text-muted">{formatDateTime(p.requested_at)}</span>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-3">
                  <div><dt className="inline">Titular: </dt><dd className="inline text-foreground">{a?.holder_name}</dd></div>
                  <div><dt className="inline">CLABE/IBAN: </dt><dd className="inline select-all text-foreground">{a?.account_ref}</dd></div>
                  <div><dt className="inline">Banco: </dt><dd className="inline text-foreground">{a?.bank_name ?? "—"}</dd></div>
                </dl>
                {p.reference && <p className="mt-2 text-xs text-muted">Ref. {p.reference}</p>}
                {p.note && <p className="mt-1 text-xs text-muted">{p.note}</p>}
                {p.status === "requested" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => resolve(p, "paid")} className="h-9 rounded-full bg-emerald-500 px-5 text-sm font-semibold text-black">Marcar pagado</button>
                    <button onClick={() => resolve(p, "rejected")} className="h-9 rounded-full border border-red-500/60 px-5 text-sm text-red-300">Rechazar</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} total={total} onChange={setPage} />
    </div>
  );
}
