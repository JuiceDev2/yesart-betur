import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProfileForm from "@/components/ProfileForm";
import AdultConfirm from "@/components/AdultConfirm";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Ajustes", robots: { index: false } };

export default async function SettingsPage() {
  const profile = await requireAuth();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-8 sm:px-6">
        <h1 className="font-serif text-3xl font-medium">Ajustes</h1>
        {!profile.age_confirmed_at && <AdultConfirm />}
        <section aria-labelledby="perfil">
          <h2 id="perfil" className="mb-4 text-lg font-semibold">Mi perfil</h2>
          <ProfileForm profile={profile} />
        </section>
        <section aria-labelledby="cuenta" className="rounded-3xl border border-border bg-card p-5">
          <h2 id="cuenta" className="text-lg font-semibold">Cuenta</h2>
          <p className="mt-1 text-sm text-muted">Correo: {profile.email}</p>
          {profile.role === "fan" && (
            <p className="mt-3 text-sm">
              ¿Quieres publicar contenido?{" "}
              <Link href="/become-creator" className="text-accent underline">Solicita ser creador</Link>
            </p>
          )}
          <p className="mt-3 text-sm">
            <Link href="/account/delete" className="text-red-300 underline">Eliminar mi cuenta</Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
