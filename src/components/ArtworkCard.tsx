"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import OrderModal from "./OrderModal";
import type { Artwork } from "@/types";

interface ArtworkCardProps {
  artwork: Artwork;
}

export default function ArtworkCard({ artwork }: ArtworkCardProps) {
  const [showOrder, setShowOrder] = useState(false);

  const priceFormatted = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(artwork.price);

  const artistName =
    artwork.artist && "full_name" in artwork.artist
      ? artwork.artist.full_name
      : "Artista";

  return (
    <>
      <article className="card-lift group overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative aspect-[4/5] overflow-hidden bg-neutral-200 dark:bg-neutral-800">
          {artwork.image_url ? (
            <Image
              src={artwork.image_url}
              alt={artwork.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-300 to-neutral-400 dark:from-neutral-700 dark:to-neutral-800">
              <span className="text-4xl opacity-30" aria-hidden>
                ✦
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          {artwork.status === "available" && (
            <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setShowOrder(true)}
                className="h-10 w-full rounded-full bg-white text-sm font-medium text-black transition-colors hover:bg-accent"
              >
                Solicitar compra
              </button>
            </div>
          )}
          {artwork.status === "sold" && (
            <div className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
              Vendido
            </div>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-medium leading-snug">
                <Link href={`/artwork/${artwork.id}`} className="hover:text-accent">
                  {artwork.title}
                </Link>
              </h3>
              <p className="mt-0.5 text-sm text-muted">
                {artistName ? (
                  <Link href={`/a/${artwork.artist_id}`} className="hover:text-accent">
                    {artistName}
                  </Link>
                ) : (
                  "Artista"
                )}
              </p>
            </div>
            <p className="whitespace-nowrap font-serif text-lg font-medium text-accent">
              {priceFormatted}
            </p>
          </div>
          {artwork.description && (
            <p className="mt-3 line-clamp-2 text-sm text-muted">{artwork.description}</p>
          )}
        </div>
      </article>

      <OrderModal
        isOpen={showOrder}
        onClose={() => setShowOrder(false)}
        itemType="artwork"
        itemId={artwork.id}
        itemTitle={artwork.title}
        priceLabel={priceFormatted}
      />
    </>
  );
}
