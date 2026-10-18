import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArtworkById } from "@/lib/data/artworks";
import ArtworkOrderButton from "@/components/ArtworkOrderButton";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const art = await getArtworkById(id);
  if (!art) return { title: "Obra no encontrada" };
  return {
    title: art.title,
    description: art.description?.slice(0, 160) || undefined,
    openGraph: {
      title: art.title,
      description: art.description?.slice(0, 160) || undefined,
      images: art.image_url ? [{ url: art.image_url }] : undefined,
    },
  };
}

export default async function ArtworkDetailPage({ params }: Props) {
  const { id } = await params;
  const art = await getArtworkById(id);
  if (!art || art.is_hidden || art.status !== "available") notFound();

  const price = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(art.price);

  const artistName =
    art.artist && "full_name" in art.artist ? art.artist.full_name : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: art.title,
    description: art.description,
    image: art.image_url || undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "MXN",
      price: art.price,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="font-serif text-xl font-semibold">
            Galería<span className="text-accent">Viva</span>
          </Link>
          <Link href="/gallery" className="text-sm text-muted hover:text-foreground">
            ← Catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-2">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-200 dark:bg-neutral-800">
          {art.image_url ? (
            <Image
              src={art.image_url}
              alt={art.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl opacity-30">
              ✦
            </div>
          )}
        </div>

        <div>
          {art.category && (
            <p className="text-sm font-medium uppercase tracking-widest text-accent">
              {art.category}
            </p>
          )}
          <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            {art.title}
          </h1>
          {artistName && (
            <p className="mt-2 text-muted">Por {artistName}</p>
          )}
          <p className="mt-6 font-serif text-3xl text-accent">{price}</p>
          {art.description && (
            <p className="mt-6 leading-relaxed text-muted whitespace-pre-line">
              {art.description}
            </p>
          )}
          <div className="mt-8">
            <ArtworkOrderButton
              itemId={art.id}
              itemTitle={art.title}
              priceLabel={price}
            />
          </div>
        </div>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
