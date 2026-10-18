"use client";

import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";

const orderSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(2, "Nombre demasiado corto")
    .max(120, "Nombre demasiado largo"),
  clientPhone: z
    .string()
    .trim()
    .min(7, "Teléfono inválido")
    .max(30, "Teléfono inválido")
    .regex(/^[+\d\s()-]+$/, "Teléfono inválido"),
  notes: z.string().max(1000).optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar el aviso de privacidad" }),
  }),
  website: z.string().max(0).optional(),
});

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: "artwork" | "service";
  itemId: string;
  itemTitle: string;
  priceLabel: string;
}

export default function OrderModal({
  isOpen,
  onClose,
  itemType,
  itemId,
  itemTitle,
  priceLabel,
}: OrderModalProps) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  function handleClose() {
    setClientName("");
    setClientPhone("");
    setNotes("");
    setHoneypot("");
    setConsent(false);
    setSuccess(false);
    setError(null);
    setFieldErrors({});
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (honeypot) {
      setSuccess(true);
      return;
    }

    const parsed = orderSchema.safeParse({
      clientName,
      clientPhone,
      notes,
      consent: consent ? true : false,
      website: honeypot || undefined,
    });

    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const key = i.path[0]?.toString() || "form";
        if (!errs[key]) errs[key] = i.message;
      });
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: parsed.data.clientName,
          clientPhone: parsed.data.clientPhone,
          notes: parsed.data.notes || null,
          artworkId: itemType === "artwork" ? itemId : null,
          serviceId: itemType === "service" ? itemId : null,
          website: "",
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo enviar la solicitud");
        return;
      }
      setSuccess(true);
      setConsent(false);
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 shadow-xl backdrop:bg-black/50 open:flex open:flex-col"
      onClose={handleClose}
    >
      {success ? (
        <div className="p-8 text-center">
          <p className="text-3xl" aria-hidden>
            ✓
          </p>
          <h2 id={titleId} className="mt-4 font-serif text-xl font-medium">
            Solicitud enviada
          </h2>
          <p className="mt-2 text-sm text-muted">
            El artista te contactará al teléfono que indicaste.
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-6 h-11 w-full rounded-full bg-foreground text-sm font-medium text-background"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          <h2 id={titleId} className="font-serif text-xl font-medium">
            Solicitar
          </h2>
          <p className="mt-1 text-sm text-muted">
            {itemTitle} · {priceLabel}
          </p>

          {/* Honeypot */}
          <div className="absolute -left-[9999px]" aria-hidden>
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="clientName" className="mb-1.5 block text-sm font-medium">
                Nombre completo
              </label>
              <input
                ref={firstFieldRef}
                id="clientName"
                name="clientName"
                required
                autoComplete="name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                aria-invalid={!!fieldErrors.clientName}
              />
              {fieldErrors.clientName && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {fieldErrors.clientName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="clientPhone" className="mb-1.5 block text-sm font-medium">
                Teléfono
              </label>
              <input
                id="clientPhone"
                name="clientPhone"
                type="tel"
                required
                autoComplete="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                aria-invalid={!!fieldErrors.clientPhone}
              />
              {fieldErrors.clientPhone && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {fieldErrors.clientPhone}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm font-medium">
                Notas (opcional)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>

            <label className="flex items-start gap-2 text-xs text-muted">
              <input
                id="consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Acepto el{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  aviso de privacidad
                </a>
                . Usaremos mi nombre y teléfono solo para contactarme sobre esta
                solicitud.
              </span>
            </label>
            {fieldErrors.consent && (
              <p className="text-xs text-red-600" role="alert">
                {fieldErrors.consent}
              </p>
            )}

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="h-11 flex-1 rounded-full border border-border text-sm font-medium hover:bg-background"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="h-11 flex-1 rounded-full bg-foreground text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Enviando…" : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </form>
      )}
    </dialog>
  );
}
