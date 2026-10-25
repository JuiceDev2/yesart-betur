"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Empty, Loading, PAGE_SIZE, Pager, Pill, formatDateTime } from "./ui";
import { REPORT_REASONS } from "@/lib/constants";

interface Report {
  id: string;
  target_type: "post" | "creator" | "comment" | "message";
  target_id: string;
  reason: string;
  details: string | null;
  priority: boolean;
  status: string;
  resolution_note: string | null;
  created_at: string;
  reporter_username: string | null;
  target_label: string | null;
  target_owner: string | null;
  target_hidden: boolean | null;
  total: number;
}

const TYPE: Record<string, string> = { post: "Publicación", creator: "Creador", comment: "Comentario", message: "Mensaje" };

export default function AdminReports() {
  const [status, setStatus] = useState<"open" | "actioned" | "dismissed">("open");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await createClient().rpc("admin_reports", {
      p_status: status,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    });
    setRows((data as Report[] | null) ?? []);
    setLoading(false);
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(r: Report, st: "actioned" | "dismissed", hide: boolean) {
    setMsg(null);
    const note = prompt(st === "actioned" ? "Nota de la decisión (opcional):" : "Motivo del descarte (opcional):") ?? null;
    const { error } = await createClient().rpc("admin_resolve_report", {
      p_report: r.id,
      p_status: st,
      p_note: note,
      p_hide_target: hide,
    });
    setMsg(error ? error.message : "Reporte resuelto");
    await load();
  }

  async function togglePost(r: Report, hidden: boolean) {
    const reason = hidden ? prompt("Motivo para ocultar la publicación:") : null;
    if (hidden && !reason) return;
    const { error } = await createClient().rpc("admin_moderate_post", { p_post: r.target_id, p_hidden: hidden, p_reason: reason });
    setMsg(error ? error.message : hidden ? "Publicación oculta" : "Publicación visible de nuevo");
    await load();
  }

  const total = rows[0]?.total ?? 0;
  const label = (v: string) => REPORT_REASONS.find((x) => x.value === v)?.label ?? v;

  return (
    <div>
      <div className="mb-4 flex gap-2" role="group" aria-label="Estado">
        {(["open", "actioned", "dismissed"] as const).map((s) => (
          <button
            key={s}
            aria-pressed={status === s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`h-8 rounded-full px-4 text-xs ${status === s ? "bg-accent font-semibold text-accent-ink" : "border border-border"}`}
          >
            {s === "open" ? "Abiertos" : s === "actioned" ? "Con acción" : "Descartados"}
          </button>
        ))}
      </div>
      {msg && <p role="status" className="mb-3 text-sm text-muted">{msg}</p>}
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>No hay reportes.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`rounded-3xl border p-4 ${r.priority ? "border-red-500/60 bg-red-500/5" : "border-border bg-card"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="gray">{TYPE[r.target_type]}</Pill>
                <Pill tone={r.priority ? "red" : "yellow"}>{label(r.reason)}</Pill>
                {r.priority && <Pill tone="red">PRIORIDAD</Pill>}
                {r.target_hidden && <Pill tone="blue">Oculta</Pill>}
                <span className="ml-auto text-xs text-muted">
                  {formatDateTime(r.created_at)} · por @{r.reporter_username ?? "—"}
                </span>
              </div>
              <p className="mt-3 text-sm">{r.target_label ?? "(contenido eliminado)"}</p>
              {r.details && <p className="mt-1 text-xs text-muted">Detalle: {r.details}</p>}
              {r.resolution_note && <p className="mt-1 text-xs text-muted">Resolución: {r.resolution_note}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {r.target_type === "post" && <Link href={`/post/${r.target_id}`} className="text-accent hover:underline">Ver publicación</Link>}
                {r.target_type === "creator" && r.target_label && <Link href={`/c/${r.target_label.replace(/^@/, "")}`} className="text-accent hover:underline">Ver perfil</Link>}
                {r.status === "open" && (
                  <>
                    {r.target_type === "post" && (
                      r.target_hidden ? (
                        <button onClick={() => togglePost(r, false)} className="rounded-full border border-border px-3 py-1">Mostrar</button>
                      ) : (
                        <button onClick={() => togglePost(r, true)} className="rounded-full border border-border px-3 py-1">Ocultar</button>
                      )
                    )}
                    <button onClick={() => resolve(r, "actioned", r.target_type === "post" || r.target_type === "comment")} className="rounded-full bg-red-500/80 px-3 py-1 font-medium text-white">
                      Dar de baja contenido y cerrar
                    </button>
                    <button onClick={() => resolve(r, "dismissed", false)} className="rounded-full border border-border px-3 py-1">Descartar</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} total={total} onChange={setPage} />
    </div>
  );
}
