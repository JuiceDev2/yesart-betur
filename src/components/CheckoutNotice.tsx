"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Tras pagar, el webhook del proveedor puede tardar unos segundos. Este aviso vuelve a
 * consultar la página unas cuantas veces para que el contenido aparezca solo.
 */
export default function CheckoutNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get("checkout");
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (status !== "success" || tries >= 6) return;
    const t = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, 2500);
    return () => clearTimeout(t);
  }, [status, tries, router]);

  if (status === "success") {
    return (
      <p role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        ¡Pago recibido! Estamos activando tu acceso{tries >= 6 ? ". Si aún no ves el contenido, recarga la página en un minuto." : "…"}
      </p>
    );
  }
  if (status === "cancel") {
    return (
      <p role="status" className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted">
        El pago fue cancelado. No se te cobró nada.
      </p>
    );
  }
  return null;
}
