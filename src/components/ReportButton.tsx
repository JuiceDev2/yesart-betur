"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { REPORT_REASONS } from "@/lib/constants";

export default function ReportButton({
  targetType,
  targetId,
  viewerId,
  label = "Reportar",
}: {
  targetType: "post" | "creator" | "comment" | "message";
  targetId: string;
  viewerId: string | null;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!viewerId) {
    return (
      <Link href="/login" className="text-xs text-muted hover:text-foreground">
        {label}
      </Link>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError("Elige un motivo");
      return;
    }
    setState("sending");
    setError(null);
    const { error } = await createClient().rpc("report_content", {
      p_type: targetType,
      p_target: targetId,
      p_reason: reason,
      p_details: details || null,
    });
    if (error) {
      setError(error.message);
      setState("idle");
      return;
    }
    setState("done");
  }

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs text-muted hover:text-foreground"
      >
        {label}
      </button>
      {open && (
        <form onSubmit={submit} className="mt-2 w-72 max-w-full space-y-2 rounded-xl border border-border bg-card p-3 text-left">
          {state === "done" ? (
            <p role="status" className="text-xs text-emerald-300">
              Gracias. Revisaremos el reporte. Los casos graves se ocultan de inmediato.
            </p>
          ) : (
            <>
              <label htmlFor={`rep-${targetId}`} className="block text-xs text-muted">
                Motivo
              </label>
              <select
                id={`rep-${targetId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value="">Elige…</option>
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <textarea
                aria-label="Detalles (opcional)"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Detalles (opcional)"
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              />
              {error && (
                <p role="alert" className="text-xs text-red-300">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={state === "sending"}
                className="h-8 w-full rounded-lg bg-foreground text-xs font-medium text-background disabled:opacity-60"
              >
                {state === "sending" ? "Enviando…" : "Enviar reporte"}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
