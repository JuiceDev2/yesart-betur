"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";
import { AGE_COOKIE } from "@/lib/constants";

const EXEMPT = ["/terms", "/privacy", "/content-policy"];

/**
 * Aviso de mayoría de edad. Es una barrera de experiencia (el acceso real al contenido
 * lo decide la base de datos con la edad confirmada de cada cuenta).
 */
export default function AgeGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [closing, setClosing] = useState(false);

  if (EXEMPT.some((p) => pathname === p)) return null;

  function accept() {
    setClosing(true);
    document.cookie = `${AGE_COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax${
      location.protocol === "https:" ? "; Secure" : ""
    }`;
    router.refresh();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0806]/95 px-6"
    >
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center">
        <div className="mb-5 flex justify-center"><Logo tagline className="text-4xl" /></div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.3em] text-muted">Solo mayores de 18</p>
        <h2 id="age-title" className="font-serif text-3xl font-medium">
          Este sitio es solo para adultos
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Puede contener contenido para mayores de edad. Al continuar confirmas que tienes al menos 18 años
          (o la mayoría de edad en tu país) y aceptas nuestros{" "}
          <a href="/terms" className="underline hover:text-accent">términos</a> y la{" "}
          <a href="/content-policy" className="underline hover:text-accent">política de contenido</a>.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={accept}
            disabled={closing}
            className="h-12 rounded-full bg-accent text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Soy mayor de 18 años · Entrar
          </button>
          <a
            href="https://www.wikipedia.org"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center rounded-full border border-border text-sm font-medium text-muted hover:text-foreground"
          >
            Soy menor de edad · Salir
          </a>
        </div>
      </div>
    </div>
  );
}
