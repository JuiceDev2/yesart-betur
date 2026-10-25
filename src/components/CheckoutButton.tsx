"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CheckoutBody } from "@/lib/validation";

/** Inicia un cobro en el servidor y redirige a la página de pago. */
export default function CheckoutButton({
  body,
  children,
  className,
  onError,
}: {
  body: CheckoutBody;
  children: React.ReactNode;
  className?: string;
  onError?: (msg: string) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string; code?: string };
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
        return;
      }
      if (json.code === "age_required") {
        router.push("/settings");
        return;
      }
      if (!res.ok || !json.url) {
        const msg = json.error ?? "No pudimos iniciar el pago";
        setError(msg);
        onError?.(msg);
        return;
      }
      window.location.assign(json.url);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={start} disabled={loading} className={className}>
        {loading ? "Redirigiendo…" : children}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </>
  );
}
