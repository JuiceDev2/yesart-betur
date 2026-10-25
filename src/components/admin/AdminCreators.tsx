"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Empty, Loading, PAGE_SIZE, Pager, Pill, SearchBox, useDebounced } from "./ui";
import { escapeFilterValue } from "@/lib/filters";
import { formatMoney } from "@/lib/money";

interface Row {
  user_id: string;
  price_cents: number;
  status: "active" | "suspended";
  suspended_reason: string | null;
  is_nsfw: boolean;
  profile: { username: string; display_name: string; email: string | null; is_active: boolean } | { username: string; display_name: string; email: string | null; is_active: boolean }[] | null;
}

export default function AdminCreators({ currency }: { currency: string }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const from = (page - 1) * PAGE_SIZE;
    let ids: string[] | null = null;
    const term = escapeFilterValue(dq);
    if (term) {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .or(`username.ilike.%${term}%,display_name.ilike.%${term}%,email.ilike.%${term}%`)
        .eq("role", "creator")
        .limit(200);
      ids = (data ?? []).map((d) => d.id as string);
    }
    if (ids && ids.length === 0) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    let query = supabase
      .from("creators")
      .select("user_id, price_cents, status, suspended_reason, is_nsfw, profile:profiles!creators_user_id_fkey(username, display_name, email, is_active)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (ids) query = query.in("user_id", ids);
    const { data, count } = await query;
    setRows((data as unknown as Row[] | null) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [dq, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(r: Row, status: "active" | "suspended") {
    setMsg(null);
    let reason: string | null = null;
    if (status === "suspended") {
      reason = prompt("Motivo de la suspensión (se notificará al creador y se cancelarán sus cobros):");
      if (!reason || reason.trim().length < 3) return;
    }
    const res = await fetch("/api/admin/creator-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId: r.user_id, status, reason }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; warning?: string };
    setMsg(res.ok ? (json.warning ?? "Estado actualizado") : (json.error ?? "No se pudo actualizar"));
    await load();
  }

  async function setActive(r: Row, active: boolean) {
    setMsg(null);
    const reason = active ? null : prompt("Motivo para deshabilitar la cuenta:");
    if (!active && (!reason || reason.trim().length < 3)) return;
    const { error } = await createClient().rpc("admin_set_user_active", { p_user: r.user_id, p_active: active, p_reason: reason });
    setMsg(error ? error.message : active ? "Cuenta habilitada" : "Cuenta deshabilitada");
    await load();
  }

  return (
    <div>
      <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por usuario, nombre o correo…" label="Buscar creadores" />
      {msg && <p role="status" className="my-3 text-sm text-muted">{msg}</p>}
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>Sin resultados.</Empty>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-3xl border border-border bg-card">
          {rows.map((r) => {
            const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
            return (
              <li key={r.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/c/${p?.username}`} className="text-sm font-medium hover:underline">@{p?.username}</Link>
                  <p className="truncate text-xs text-muted">
                    {p?.display_name} · {p?.email} · {r.price_cents === 0 ? "Gratis" : `${formatMoney(r.price_cents, currency)}/mes`}
                  </p>
                  {r.suspended_reason && <p className="text-xs text-red-300">Motivo: {r.suspended_reason}</p>}
                </div>
                <Pill tone={r.status === "active" ? "green" : "red"}>{r.status === "active" ? "Activo" : "Suspendido"}</Pill>
                {r.is_nsfw && <Pill tone="pink">+18</Pill>}
                {p && !p.is_active && <Pill tone="gray">Cuenta deshabilitada</Pill>}
                {r.status === "active" ? (
                  <button onClick={() => setStatus(r, "suspended")} className="text-xs text-muted hover:text-red-300">Suspender</button>
                ) : (
                  <button onClick={() => setStatus(r, "active")} className="text-xs text-accent hover:underline">Reactivar</button>
                )}
                {p?.is_active ? (
                  <button onClick={() => setActive(r, false)} className="text-xs text-muted hover:text-red-300">Deshabilitar cuenta</button>
                ) : (
                  <button onClick={() => setActive(r, true)} className="text-xs text-accent hover:underline">Habilitar cuenta</button>
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
