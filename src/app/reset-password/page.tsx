"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError("Mínimo 10 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    router.push("/login?reset=ok");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
          <Link href="/" className="font-serif text-xl font-semibold">
            Galería<span className="text-accent">Viva</span>
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="mb-8 text-center font-serif text-3xl font-medium">
            Nueva contraseña
          </h1>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Contraseña nueva
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">
                Confirmar
              </label>
              <input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-full bg-foreground text-sm font-medium text-background disabled:opacity-50"
            >
              {loading ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
