"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { Empty, Loading, PAGE_SIZE, Pager, Pill } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

interface Row {
  fan_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status: string;
  price_cents: number;
  provider: string;
  current_period_end: string;
  since: string;
  total: number;
}

export default function StudioSubscribers({ currency }: { currency: string }) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await createClient().rpc("my_subscribers", {
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    });
    setRows((data as Row[] | null) ?? []);
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function block(fanId: string, username: string) {
    if (!confirm(`¿Bloquear a @${username}? Perderá el acceso y se cancelará su suscripción.`)) return;
    setMsg(null);
    const res = await fetch("/api/creator/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fanId, blocked: true }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; warning?: string };
    setMsg(res.ok ? (json.warning ?? `@${username} fue bloqueado`) : (json.error ?? "No se pudo bloquear"));
    await load();
  }

  const total = rows[0]?.total ?? 0;
  if (loading && rows.length === 0) return <Loading />;
  if (rows.length === 0) return <Empty>Todavía no tienes suscriptores.</Empty>;

  return (
    <>
      {msg && (
        <p role="status" className="mb-3 text-sm text-muted">
          {msg}
        </p>
      )}
      <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
        {rows.map((r) => {
          const live = new Date(r.current_period_end).getTime() > Date.now();
          return (
            <li key={r.fan_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar url={r.avatar_url} name={r.display_name || r.username} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">@{r.username}</p>
                <p className="text-xs text-muted">
                  Desde {formatDate(r.since)} ·{" "}
                  {r.provider === "free" ? "Seguidor gratuito" : `${formatMoney(r.price_cents, currency)}/mes`}
                </p>
              </div>
              <Pill tone={live && r.status === "active" ? "green" : live && r.status === "canceled" ? "yellow" : "gray"}>
                {live && r.status === "active" ? "Activo" : live && r.status === "canceled" ? "Cancela el " + formatDate(r.current_period_end) : "Inactivo"}
              </Pill>
              <Link href={`/messages/${r.fan_id}`} className="text-xs text-accent hover:underline">
                Mensaje
              </Link>
              <button type="button" onClick={() => block(r.fan_id, r.username)} className="text-xs text-muted hover:text-red-300">
                Bloquear
              </button>
            </li>
          );
        })}
      </ul>
      <Pager page={page} total={total} onChange={setPage} />
    </>
  );
}
