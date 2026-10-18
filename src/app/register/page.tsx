"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { z } from "zod";

const schema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().email(),
    phone: z.string().max(30).optional(),
    password: z.string().min(10, "Mínimo 10 caracteres"),
    confirm: z.string(),
    privacy: z.literal(true, {
      errorMap: () => ({ message: "Debes aceptar el aviso de privacidad" }),
    }),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Muy débil", "Débil", "Aceptable", "Fuerte", "Muy fuerte"];
  return { score, label: labels[Math.min(score, 4)] };
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const strength = passwordStrength(password);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = schema.safeParse({
      fullName,
      email,
      phone,
      password,
      confirm,
      privacy: privacy ? true : undefined,
    });

    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0]?.toString() || "form";
        if (!errs[k]) errs[k] = i.message;
      });
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
          phone: parsed.data.phone || "",
          // role intentionally omitted — always client via trigger
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(
        signUpError.message.includes("already")
          ? "Este correo ya está registrado"
          : "No se pudo crear la cuenta. Intenta de nuevo."
      );
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <Shell>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-2xl">
            ✉
          </div>
          <h2 className="font-serif text-2xl font-medium">Revisa tu correo</h2>
          <p className="mx-auto max-w-sm text-sm text-muted">
            Te enviamos un enlace de confirmación a <strong>{email}</strong>. Ábrelo para
            activar tu cuenta.
          </p>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background"
          >
            Ir a iniciar sesión
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-8 text-center">
        <h1 className="font-serif text-3xl font-medium">Crear cuenta</h1>
        <p className="mt-2 text-sm text-muted">
          Todas las cuentas empiezan como cliente. Puedes solicitar ser artista después.
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-5" noValidate>
        <Field
          id="fullName"
          label="Nombre completo"
          value={fullName}
          onChange={setFullName}
          error={fieldErrors.fullName}
          autoComplete="name"
          required
        />
        <Field
          id="email"
          label="Correo electrónico"
          type="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
          autoComplete="email"
          required
        />
        <Field
          id="phone"
          label="Teléfono (opcional)"
          type="tel"
          value={phone}
          onChange={setPhone}
          error={fieldErrors.phone}
          autoComplete="tel"
        />
        <div>
          <Field
            id="password"
            label="Contraseña"
            type="password"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
            autoComplete="new-password"
            required
            hint="Mínimo 10 caracteres"
          />
          {password.length > 0 && (
            <p className="mt-1.5 text-xs text-muted">
              Fortaleza: <span className="font-medium">{strength.label}</span>
            </p>
          )}
        </div>
        <Field
          id="confirm"
          label="Confirmar contraseña"
          type="password"
          value={confirm}
          onChange={setConfirm}
          error={fieldErrors.confirm}
          autoComplete="new-password"
          required
        />

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <span>
            Acepto el{" "}
            <Link href="/privacy" className="underline hover:text-accent">
              aviso de privacidad
            </Link>
          </span>
        </label>
        {fieldErrors.privacy && (
          <p className="text-xs text-red-600" role="alert">
            {fieldErrors.privacy}
          </p>
        )}

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
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-foreground hover:text-accent">
          Inicia sesión
        </Link>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
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
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  autoComplete,
  required,
  hint,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
