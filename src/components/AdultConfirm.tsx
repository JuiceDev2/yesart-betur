"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Para cuentas que aún no confirmaron su mayoría de edad. */
export default function AdultConfirm() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("confirm_adult");
    setBusy(false);
    if (error) {
      setError("No se pudo confirmar. Intenta de nuevo.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-5">
      <p className="font-medium text-amber-100">Confirma que eres mayor de edad</p>
      <p className="mt-1 text-sm text-amber-100/80">
        Necesitamos tu confirmación para suscribirte, comentar o ver contenido para adultos.
      </p>
      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>Tengo 18 años o más y acepto los términos y la política de contenido.</span>
      </label>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={confirm}
        disabled={!checked || busy}
        className="mt-4 h-10 rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink disabled:opacity-50"
      >
        Confirmar
      </button>
    </div>
  );
}
