import { requireAuth } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import ArtistPanel from "@/components/ArtistPanel";

export default async function ArtistPage() {
  const profile = await requireAuth(["artist"]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader profile={profile} label="Panel Artista" />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-medium tracking-tight">
            Mi estudio
          </h1>
          <p className="mt-1 text-sm text-muted">
            Gestiona obras, servicios de murales y órdenes de clientes
          </p>
        </div>
        <ArtistPanel profile={profile} />
      </main>
    </div>
  );
}
