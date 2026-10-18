"use client";

import { useState } from "react";
import OrderModal from "./OrderModal";

export default function ArtworkOrderButton({
  itemId,
  itemTitle,
  priceLabel,
  itemType = "artwork",
}: {
  itemId: string;
  itemTitle: string;
  priceLabel: string;
  itemType?: "artwork" | "service";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-12 rounded-full bg-foreground px-8 text-sm font-medium text-background hover:opacity-90"
      >
        Solicitar compra
      </button>
      <OrderModal
        isOpen={open}
        onClose={() => setOpen(false)}
        itemType={itemType}
        itemId={itemId}
        itemTitle={itemTitle}
        priceLabel={priceLabel}
      />
    </>
  );
}
