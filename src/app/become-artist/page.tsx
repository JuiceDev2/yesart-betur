"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function BecomeArtistPage() {
  const [message, setMessage] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "already" | "need_login">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStatus("need_login");
        return;
      }
      const { data } = await supabase
        .from("artist_applications")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();
      if (data) setStatus("already");
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login?next=/become-artist");
      return;
    }

    const { error: insertError } = await supabase.from("artist_applications").insert({
      user_id: user.id,
      message: message.trim() || null,
      portfolio_url: portfolio.trim() || null,
      status: "pending",
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }
    setStatus("sent");
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
          <Link href="/" className="font-serif text-xl font-semibold">
            Yesart<span className="text-accent">-betur</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-lg flex-1 flex-col justify-center px-6 py-12">
        {status === "need_login" && (
          <div className="space-y-4 text-center">
            <h1 className="font-serif text-2xl font-medium">Inicia sesión primero</h1>
            <p className="text-sm text-muted">
              Necesitas una cuenta de cliente para solicitar ser artista.
            </p>
            <Link
              href="/login?next=/become-artist"
              className="inline-flex h-10 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background"
            >
              Iniciar sesión
            </Link>
          </div>
        )}

        {status === "already" && (
          <div className="space-y-4 text-center">
            <h1 className="font-serif text-2xl font-medium">Solicitud pendiente</h1>
            <p className="text-sm text-muted">
              Ya tienes una solicitud en revisión. Te avisaremos cuando se apruebe.
            </p>
            <Link href="/dashboard" className="text-sm font-medium text-accent">
              Ir a mi cuenta
            </Link>
          </div>
        )}

        {status === "sent" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-2xl">
              ✓
            </div>
            <h1 className="font-serif text-2xl font-medium">Solicitud enviada</h1>
            <p className="text-sm text-muted">
              El equipo revisará tu perfil. Cuando te aprueben, podrás publicar obras.
            </p>
            <Link href="/dashboard" className="text-sm font-medium text-accent">
              Ir a mi cuenta
            </Link>
          </div>
        )}

        {status === "idle" && (
          <>
            <h1 className="mb-2 font-serif text-3xl font-medium">Solicitar ser artista</h1>
            <p className="mb-8 text-sm text-muted">
              Cuéntanos un poco sobre tu trabajo. Revisamos cada solicitud.
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="portfolio" className="mb-1.5 block text-sm font-medium">
                  Portafolio o redes (URL)
                </label>
                <input
                  id="portfolio"
                  type="url"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
                  Mensaje
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  placeholder="Estilos, experiencia, ciudad..."
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
                {loading ? "Enviando…" : "Enviar solicitud"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
