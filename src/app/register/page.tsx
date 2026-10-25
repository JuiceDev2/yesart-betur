"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";
import { registerSchema } from "@/lib/validation";

const input =
  "h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40";

function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return { score, label: ["Muy débil", "Débil", "Aceptable", "Fuerte", "Muy fuerte", "Muy fuerte"][score] };
}

function Field({
  id, label, value, onChange, error, type = "text", autoComplete, hint,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string;
  type?: string; autoComplete?: string; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={input}
      />
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const strength = passwordStrength(password);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = registerSchema.safeParse({
      displayName,
      username: username.trim().toLowerCase(),
      email,
      password,
      confirm,
      age: age ? true : undefined,
      terms: terms ? true : undefined,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0]?.toString() || "form";
        if (!errs[k]) errs[k] = i.message;
      }
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    const { error: signUpError } = await createClient().auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          display_name: parsed.data.displayName,
          username: parsed.data.username,
          age_confirmed: "true",
          terms_accepted: "true",
          // El rol no se envía: el trigger siempre crea una cuenta de fan.
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes("already")
          ? "Este correo ya está registrado"
          : "No se pudo crear la cuenta. Intenta de nuevo."
      );
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <AuthShell>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-2xl" aria-hidden>✉</div>
          <h1 className="text-2xl font-semibold">Revisa tu correo</h1>
          <p className="mx-auto max-w-sm text-sm text-muted">
            Te enviamos un enlace de confirmación a <strong>{email}</strong>. Ábrelo para activar tu cuenta.
          </p>
          <Link href="/login" className="inline-flex h-10 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink">
            Ir a iniciar sesión
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold">Crear cuenta</h1>
        <p className="mt-2 text-sm text-muted">Todas las cuentas empiezan como fan. Puedes solicitar ser creador después.</p>
      </div>
      <form onSubmit={handleRegister} className="space-y-5" noValidate>
        <Field id="displayName" label="Nombre para mostrar" value={displayName} onChange={setDisplayName} error={fieldErrors.displayName} autoComplete="name" />
        <Field id="username" label="Nombre de usuario" value={username} onChange={setUsername} error={fieldErrors.username} autoComplete="username" hint="3 a 24 caracteres: minúsculas, números y guion bajo. Será tu enlace: aura.app/c/usuario" />
        <Field id="email" label="Correo electrónico" type="email" value={email} onChange={setEmail} error={fieldErrors.email} autoComplete="email" />
        <div>
          <Field id="password" label="Contraseña" type="password" value={password} onChange={setPassword} error={fieldErrors.password} autoComplete="new-password" />
          {password && (
            <div className="mt-2" aria-live="polite">
              <div className="flex gap-1" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full ${i < strength.score ? "bg-accent" : "bg-border"}`} />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">Seguridad: {strength.label}</p>
            </div>
          )}
        </div>
        <Field id="confirm" label="Confirmar contraseña" type="password" value={confirm} onChange={setConfirm} error={fieldErrors.confirm} autoComplete="new-password" />

        <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>Confirmo que tengo <strong>18 años o más</strong>.</span>
          </label>
          {fieldErrors.age && <p className="text-xs text-red-300">{fieldErrors.age}</p>}
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              Acepto los <Link href="/terms" className="underline hover:text-accent" target="_blank">términos</Link>, la{" "}
              <Link href="/content-policy" className="underline hover:text-accent" target="_blank">política de contenido</Link> y el{" "}
              <Link href="/privacy" className="underline hover:text-accent" target="_blank">aviso de privacidad</Link>.
            </span>
          </label>
          {fieldErrors.terms && <p className="text-xs text-red-300">{fieldErrors.terms}</p>}
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={loading} className="h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50">
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tienes cuenta? <Link href="/login" className="font-medium text-foreground hover:text-accent">Inicia sesión</Link>
      </p>
    </AuthShell>
  );
}
