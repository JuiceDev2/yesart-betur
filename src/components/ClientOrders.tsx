"use client";

import { useState } from "react";
import { orderStatusLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/types";

export default function ClientOrders({
  initialOrders,
}: {
  initialOrders: Order[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function cancel(id: string) {
    if (!confirm("¿Cancelar esta solicitud?")) return;
    setLoadingId(id);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_order_status", {
      p_order_id: id,
      p_new_status: "cancelled",
    });
    if (!error) {
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: "cancelled" } : o))
      );
    } else {
      alert(error.message);
    }
    setLoadingId(null);
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted">
        Aún no has hecho solicitudes. Explora el{" "}
        <a href="/gallery" className="text-accent underline">
          catálogo
        </a>
        .
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const title =
          order.artwork?.title ||
          order.service?.title ||
          (order.artwork_id ? "Obra" : "Servicio");
        return (
          <div
            key={order.id}
            className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center"
          >
            <div>
              <p className="font-medium">{title}</p>
              <p className="mt-0.5 text-xs capitalize text-muted">
                {orderStatusLabel(order.status)} ·{" "}
                {new Date(order.created_at).toLocaleDateString("es-MX")}
              </p>
              {order.artist && "full_name" in order.artist && order.artist.full_name && (
                <p className="mt-1 text-xs text-muted">
                  Artista:{" "}
                  <a href={`/a/${order.artist_id}`} className="text-accent underline">
                    {order.artist.full_name}
                  </a>
                </p>
              )}
              {order.status === "contacted" && (
                <p className="mt-1 text-xs text-accent">
                  El artista te contactará al teléfono que indicaste.
                </p>
              )}
            </div>
            {order.status === "pending" && (
              <button
                type="button"
                disabled={loadingId === order.id}
                onClick={() => cancel(order.id)}
                className="h-9 shrink-0 rounded-lg border border-border px-4 text-xs font-medium text-muted hover:text-red-600 disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
