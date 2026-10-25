"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

export default function DeleteAccountPage() {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (confirm !== "ELIMINAR") {
      setError("Escribe ELIMINAR para confirmar");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo eliminar");
      setLoading(false);
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    setDone(true);
    setLoading(false);
    setTimeout(() => router.push("/"), 2000);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
          <Link href="/" className="inline-flex">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md flex-1 px-6 py-16">
        {done ? (
          <p className="text-center text-sm text-muted">Cuenta eliminada. Redirigiendo…</p>
        ) : (
          <>
            <h1 className="text-2xl font-medium">Eliminar cuenta</h1>
            <p className="mt-3 text-sm text-muted">
              Se eliminará tu perfil, tus publicaciones y archivos, y se cancelarán tus suscripciones activas. Los registros de pagos se conservan sin tus datos personales por obligación contable. Si eres creador, primero debes retirar tu saldo.</p>
            <form onSubmit={handleDelete} className="mt-8 space-y-4">
              <div>
                <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">
                  Escribe ELIMINAR para confirmar
                </label>
                <input
                  id="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
              {error && (
                <p className="text-sm text-red-300" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-full bg-red-600 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? "Eliminando…" : "Eliminar mi cuenta"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
