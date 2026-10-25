"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Empty, Loading, PAGE_SIZE, Pager, Pill, formatDateTime } from "./ui";
import { isAtLeastYearsOld } from "@/lib/validation";

interface App {
  id: string;
  user_id: string;
  legal_name: string;
  birth_date: string;
  country: string;
  id_doc_path: string | null;
  selfie_path: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  kyc_purged_at: string | null;
  created_at: string;
  applicant: { username: string; email: string | null } | { username: string; email: string | null }[] | null;
}

export default function AdminApplications() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<App[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Record<string, { id?: string; selfie?: string }>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await createClient()
      .from("creator_applications")
      .select(
        "id, user_id, legal_name, birth_date, country, id_doc_path, selfie_path, message, status, review_note, kyc_purged_at, created_at, applicant:profiles!creator_applications_user_id_fkey(username, email)",
        { count: "exact" }
      )
      .eq("status", status)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    setRows((data as unknown as App[] | null) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function showDocs(a: App) {
    if (!a.id_doc_path || !a.selfie_path) return;
    const { data } = await createClient().storage.from("kyc").createSignedUrls([a.id_doc_path, a.selfie_path], 300);
    setDocs((d) => ({ ...d, [a.id]: { id: data?.[0]?.signedUrl ?? undefined, selfie: data?.[1]?.signedUrl ?? undefined } }));
  }

  async function decide(a: App, action: "approve" | "reject") {
    setMsg(null);
    const note = (notes[a.id] ?? "").trim();
    if (action === "reject" && !note) {
      setMsg("Escribe el motivo del rechazo (se le enviará al solicitante).");
      return;
    }
    if (action === "approve" && !confirm(`¿Aprobar a ${a.legal_name}? Confirma que revisaste su identificación y su edad.`)) return;
    setBusyId(a.id);
    const res = await fetch("/api/admin/application", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId: a.id, action, note: note || null }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusyId(null);
    setMsg(res.ok ? "Solicitud procesada" : (json.error ?? "No se pudo procesar"));
    await load();
  }

  return (
    <div>
      <div className="mb-4 flex gap-2" role="group" aria-label="Estado">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`h-8 rounded-full px-4 text-xs ${status === s ? "bg-accent font-semibold text-accent-ink" : "border border-border"}`}
          >
            {s === "pending" ? "Pendientes" : s === "approved" ? "Aprobadas" : "Rechazadas"}
          </button>
        ))}
      </div>
      {msg && <p role="status" className="mb-3 text-sm text-muted">{msg}</p>}
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>No hay solicitudes en este estado.</Empty>
      ) : (
        <ul className="space-y-4">
          {rows.map((a) => {
            const who = Array.isArray(a.applicant) ? a.applicant[0] : a.applicant;
            const adult = isAtLeastYearsOld(a.birth_date, 18);
            const d = docs[a.id];
            return (
              <li key={a.id} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.legal_name}</p>
                    <p className="text-xs text-muted">
                      @{who?.username} · {who?.email} · {a.country} · nac. {a.birth_date} · {formatDateTime(a.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Pill tone={adult ? "green" : "red"}>{adult ? "+18 verificado por fecha" : "MENOR DE EDAD"}</Pill>
                    {a.status !== "pending" && <Pill tone={a.status === "approved" ? "green" : "red"}>{a.status === "approved" ? "Aprobada" : "Rechazada"}</Pill>}
                  </div>
                </div>
                {a.message && <p className="mt-3 text-sm text-muted">“{a.message}”</p>}
                {a.review_note && <p className="mt-2 text-xs text-muted">Nota: {a.review_note}</p>}

                {a.kyc_purged_at ? (
                  <p className="mt-3 text-xs text-muted">Documentos eliminados el {formatDateTime(a.kyc_purged_at)} (política de retención).</p>
                ) : (
                  <div className="mt-3">
                    {!d ? (
                      <button type="button" onClick={() => showDocs(a)} className="h-8 rounded-full border border-border px-4 text-xs hover:border-accent">
                        Ver documentos (enlace de 5 min)
                      </button>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[["Identificación", d.id], ["Selfie con identificación", d.selfie]].map(([label, url]) => (
                          <figure key={label}>
                            <figcaption className="mb-1 text-xs text-muted">{label}</figcaption>
                            {url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt={label ?? ""} className="max-h-72 w-full rounded-xl object-contain bg-black" />
                            ) : (
                              <p className="text-xs text-red-300">No disponible</p>
                            )}
                          </figure>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {a.status === "pending" && (
                  <div className="mt-4 space-y-3">
                    <input
                      aria-label="Motivo o nota"
                      value={notes[a.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
                      maxLength={500}
                      placeholder="Nota (obligatoria si rechazas)"
                      className="h-10 w-full rounded-xl border border-border bg-background px-4 text-sm"
                    />
                    <div className="flex gap-2">
                      <button disabled={busyId === a.id || !adult} onClick={() => decide(a, "approve")} className="h-9 rounded-full bg-emerald-500 px-5 text-sm font-semibold text-black disabled:opacity-50">
                        Aprobar
                      </button>
                      <button disabled={busyId === a.id} onClick={() => decide(a, "reject")} className="h-9 rounded-full border border-red-500/60 px-5 text-sm text-red-300 disabled:opacity-50">
                        Rechazar
                      </button>
                    </div>
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
