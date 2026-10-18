"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import OrderModal from "./OrderModal";
import type { Service } from "@/types";

interface ServiceCardProps {
  service: Service;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  const [showOrder, setShowOrder] = useState(false);

  const priceFormatted = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(service.price_per_hour);

  const artistName =
    service.artist && "full_name" in service.artist
      ? service.artist.full_name
      : "Artista";

  return (
    <>
      <div className="card-lift rounded-2xl border border-border bg-card p-6">
        <div className="relative mb-5 h-40 overflow-hidden rounded-xl bg-neutral-200 dark:bg-neutral-800">
          {service.image_url ? (
            <Image
              src={service.image_url}
              alt={service.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5">
              <span className="text-3xl opacity-40" aria-hidden>
                🎨
              </span>
            </div>
          )}
        </div>
        <h3 className="text-lg font-medium">
          <Link href={`/service/${service.id}`} className="hover:text-accent">
            {service.title}
          </Link>
        </h3>
        {service.description && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
            {service.description}
          </p>
        )}
        <p className="mt-1 text-xs text-muted">
          {artistName ? (
            <Link href={`/a/${service.artist_id}`} className="hover:text-accent">
              {artistName}
            </Link>
          ) : (
            "Artista"
          )}
        </p>
        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm">
            <span className="font-serif text-xl font-medium text-accent">
              {priceFormatted}
            </span>
            <span className="text-muted"> / hora</span>
          </p>
          <button
            type="button"
            onClick={() => setShowOrder(true)}
            className="text-sm font-medium text-foreground transition-colors hover:text-accent"
          >
            Contactar →
          </button>
        </div>
      </div>

      <OrderModal
        isOpen={showOrder}
        onClose={() => setShowOrder(false)}
        itemType="service"
        itemId={service.id}
        itemTitle={service.title}
        priceLabel={`${priceFormatted} / hora`}
      />
    </>
  );
}
