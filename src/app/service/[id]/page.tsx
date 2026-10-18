import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServiceById } from "@/lib/data/services";
import ArtworkOrderButton from "@/components/ArtworkOrderButton";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const svc = await getServiceById(id);
  if (!svc) return { title: "Servicio no encontrado" };
  return {
    title: svc.title,
    description: svc.description?.slice(0, 160) || undefined,
    openGraph: {
      title: svc.title,
      images: svc.image_url ? [{ url: svc.image_url }] : undefined,
    },
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { id } = await params;
  const svc = await getServiceById(id);
  if (!svc || svc.is_hidden || !svc.is_active) notFound();

  const price = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(svc.price_per_hour);

  const artistName =
    svc.artist && "full_name" in svc.artist ? svc.artist.full_name : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="font-serif text-xl font-semibold">
            Yesart<span className="text-accent">-betur</span>
          </Link>
          <Link href="/gallery?tab=servicios" className="text-sm text-muted hover:text-foreground">
            ← Catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-2">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-neutral-200 dark:bg-neutral-800">
          {svc.image_url ? (
            <Image
              src={svc.image_url}
              alt={svc.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl opacity-30">
              🎨
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Servicio
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            {svc.title}
          </h1>
          {artistName && <p className="mt-2 text-muted">Por {artistName}</p>}
          <p className="mt-6 font-serif text-3xl text-accent">
            {price}
            <span className="text-base text-muted"> / hora</span>
          </p>
          {svc.description && (
            <p className="mt-6 leading-relaxed text-muted whitespace-pre-line">
              {svc.description}
            </p>
          )}
          <div className="mt-8">
            <ArtworkOrderButton
              itemId={svc.id}
              itemTitle={svc.title}
              priceLabel={`${price} / hora`}
              itemType="service"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
