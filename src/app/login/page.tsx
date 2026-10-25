"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";

const input =
  "h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();

  const urlError = params.get("error");
  const resetOk = params.get("reset");
  const nextRaw = params.get("next") || "";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "";

  // Si se llega con una cuenta deshabilitada o suspendida, se cierra la sesión para evitar bucles.
  useEffect(() => {
    if (urlError === "disabled" || urlError === "suspended") {
      void createClient().auth.signOut();
    }
  }, [urlError]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
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

    const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
    if (!profile || !profile.is_active) {
      await supabase.auth.signOut();
      setError("Tu cuenta está deshabilitada. Contacta a soporte.");
      setLoading(false);
      return;
    }

    if (next) router.push(next);
    else if (profile.role === "admin") router.push("/admin");
    else if (profile.role === "creator") router.push("/studio");
    else router.push("/feed");
    router.refresh();
  }

  return (
    <>
      {(urlError === "disabled" || urlError === "suspended" || urlError === "auth") && (
        <p role="alert" className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {urlError === "disabled"
            ? "Tu cuenta está deshabilitada."
            : urlError === "suspended"
              ? "Tu perfil de creador está suspendido. Revisa tu correo o contacta a soporte."
              : "El enlace de autenticación no es válido o expiró."}
        </p>
      )}
      {resetOk && (
        <p role="status" className="mb-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Contraseña actualizada. Ya puedes entrar.
        </p>
      )}
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Correo electrónico</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={input} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium">Contraseña</label>
            <Link href="/forgot-password" className="text-xs text-muted hover:text-accent">Olvidé mi contraseña</Link>
          </div>
          <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={input} />
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        )}
        <button type="submit" disabled={loading} className="h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50">
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-muted">Accede a tu cuenta de Aura</p>
      </div>
      <Suspense fallback={<p className="text-center text-sm text-muted">Cargando…</p>}>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-foreground hover:text-accent">Regístrate</Link>
      </p>
    </AuthShell>
  );
}
