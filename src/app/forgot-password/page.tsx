"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    // Always show success to avoid email enumeration
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
          <Link href="/" className="inline-flex">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {sent ? (
            <div className="space-y-4 text-center">
              <h1 className="text-2xl font-medium">Revisa tu correo</h1>
              <p className="text-sm text-muted">
                Si existe una cuenta con ese correo, enviamos un enlace para restablecer
                la contraseña.
              </p>
              <Link href="/login" className="text-sm font-medium text-accent">
                Volver al login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="mb-2 text-center text-3xl font-medium">
                Olvidé mi contraseña
              </h1>
              <p className="mb-8 text-center text-sm text-muted">
                Te enviaremos un enlace para crear una nueva.
              </p>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-ink disabled:opacity-50"
                >
                  {loading ? "Enviando…" : "Enviar enlace"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
