import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listArtworks } from "@/lib/data/artworks";
import { listServices } from "@/lib/data/services";
import ArtworkCard from "@/components/ArtworkCard";
import ServiceCard from "@/components/ServiceCard";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_artists")
    .select("full_name, bio")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { title: "Artista" };
  return {
    title: data.full_name || "Artista",
    description: data.bio?.slice(0, 160) || undefined,
  };
}

export default async function PublicArtistPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: artist } = await supabase
    .from("public_artists")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!artist) notFound();

  const [arts, svcs] = await Promise.all([
    listArtworks({ artistId: id, pageSize: 24 }),
    listServices({ artistId: id, pageSize: 24 }),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="font-serif text-xl font-semibold">
            Galería<span className="text-accent">Viva</span>
          </Link>
          <Link href="/gallery" className="text-sm text-muted hover:text-foreground">
            Catálogo
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="font-serif text-3xl font-medium">
          {artist.full_name || "Artista"}
        </h1>
        {artist.bio && <p className="mt-3 max-w-2xl text-muted">{artist.bio}</p>}

        <h2 className="mb-6 mt-12 font-medium">Obras</h2>
        {arts.items.length === 0 ? (
          <p className="text-sm text-muted">Sin obras publicadas por ahora.</p>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {arts.items.map((art) => (
              <ArtworkCard key={art.id} artwork={art} />
            ))}
          </div>
        )}

        <h2 className="mb-6 mt-16 font-medium">Servicios</h2>
        {svcs.items.length === 0 ? (
          <p className="text-sm text-muted">Sin servicios publicados por ahora.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {svcs.items.map((svc) => (
              <ServiceCard key={svc.id} service={svc} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
