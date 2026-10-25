"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Empty, Loading, PAGE_SIZE, Pager, formatDateTime } from "./ui";

interface Row {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  actor: { username: string } | { username: string }[] | null;
}

export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await createClient()
      .from("audit_log")
      .select("id, action, target_type, target_id, meta, created_at, actor:profiles!audit_log_actor_id_fkey(username)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    setRows((data as unknown as Row[] | null) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && rows.length === 0) return <Loading />;
  if (rows.length === 0) return <Empty>Sin registros.</Empty>;
  return (
    <>
      <div className="overflow-x-auto rounded-3xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Quién</th>
              <th className="px-4 py-3 font-medium">Acción</th>
              <th className="px-4 py-3 font-medium">Objetivo</th>
              <th className="px-4 py-3 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const a = Array.isArray(r.actor) ? r.actor[0] : r.actor;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-2.5">{a ? `@${a.username}` : "sistema"}</td>
                  <td className="px-4 py-2.5 font-medium">{r.action}</td>
                  <td className="px-4 py-2.5">{r.target_type}{r.target_id ? ` · ${r.target_id.slice(0, 8)}` : ""}</td>
                  <td className="max-w-64 truncate px-4 py-2.5 text-muted">{r.meta ? JSON.stringify(r.meta) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} onChange={setPage} />
    </>
  );
}
