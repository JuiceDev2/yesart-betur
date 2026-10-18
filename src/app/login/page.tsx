"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlError = searchParams.get("error");
  const resetOk = searchParams.get("reset");
  const nextRaw = searchParams.get("next") || "";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Correo o contraseña incorrectos");
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("No se pudo iniciar sesión");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (profile?.role === "artist" && !profile.is_active) {
      await supabase.auth.signOut();
      setError("Tu cuenta de artista está deshabilitada. Contacta al administrador.");
      setLoading(false);
      return;
    }

    if (next) {
      router.push(next);
    } else if (profile?.role === "admin") {
      router.push("/admin");
    } else if (profile?.role === "artist") {
      router.push("/artist");
    } else {
      router.push("/dashboard");
    }
    router.refresh();
  }

  return (
    <>
      {(urlError === "disabled" || urlError === "auth") && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">
          {urlError === "disabled"
            ? "Tu cuenta está deshabilitada."
            : "El enlace de autenticación no es válido o expiró."}
        </p>
      )}
      {resetOk && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30">
          Contraseña actualizada. Ya puedes entrar.
        </p>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
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
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium">
              Contraseña
            </label>
            <Link href="/forgot-password" className="text-xs text-muted hover:text-accent">
              Olvidé mi contraseña
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        {error && (
          <p
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-full bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
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
          <div className="mb-8 text-center">
            <h1 className="font-serif text-3xl font-medium">Iniciar sesión</h1>
            <p className="mt-2 text-sm text-muted">Accede a tu cuenta</p>
          </div>
          <Suspense fallback={<p className="text-center text-sm text-muted">Cargando…</p>}>
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-center text-sm text-muted">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="font-medium text-foreground hover:text-accent">
              Regístrate
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
