import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ApplicationForm from "@/components/ApplicationForm";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ser creador", robots: { index: false } };

export default async function BecomeCreatorPage() {
  const profile = await requireAuth(["fan"]);
  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("creator_applications")
    .select("status, review_note, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="font-serif text-3xl font-medium">Quiero ser creador</h1>
        <p className="mt-2 mb-8 text-sm text-muted">
          Verificamos la identidad y la mayoría de edad de cada creador antes de que publique. La revisión es manual y
          suele tardar uno o dos días hábiles.
        </p>

        {!profile.age_confirmed_at ? (
          <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            Primero confirma tu mayoría de edad en{" "}
            <Link href="/settings" className="text-accent underline">Ajustes</Link>.
          </p>
        ) : latest?.status === "pending" ? (
          <div role="status" className="rounded-3xl border border-border bg-card p-6">
            <p className="font-medium">Solicitud en revisión</p>
            <p className="mt-1 text-sm text-muted">Te avisaremos por correo en cuanto tengamos una respuesta.</p>
          </div>
        ) : (
          <>
            {latest?.status === "rejected" && (
              <p role="status" className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
                Tu solicitud anterior no fue aprobada{latest.review_note ? `: ${latest.review_note}` : "."} Puedes volver a intentarlo.
              </p>
            )}
            <ApplicationForm userId={profile.id} />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
