"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import ArtworkForm from "./ArtworkForm";
import ServiceForm from "./ServiceForm";
import { orderStatusLabel } from "@/lib/labels";
import ProfileForm from "./ProfileForm";
import type { Artwork, Service, Order, Profile } from "@/types";
import { deleteStorageImage } from "@/lib/storage";

interface ArtistPanelProps {
  profile: Profile;
}

type Tab = "obras" | "servicios" | "ordenes" | "perfil";
type FormMode = "none" | "artwork-new" | "artwork-edit" | "service-new" | "service-edit";

export default function ArtistPanel({ profile }: ArtistPanelProps) {
  const [tab, setTab] = useState<Tab>("obras");
  const [formMode, setFormMode] = useState<FormMode>("none");
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingArtwork, setEditingArtwork] = useState<Artwork | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    const [artRes, servRes, ordRes] = await Promise.all([
      supabase
        .from("artworks")
        .select("*")
        .eq("artist_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("services")
        .select("*")
        .eq("artist_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("*")
        .eq("artist_id", profile.id)
        .order("created_at", { ascending: false }),
    ]);

    if (artRes.data) setArtworks(artRes.data);
    if (servRes.data) setServices(servRes.data);
    if (ordRes.data) setOrders(ordRes.data);
    setLoading(false);
  }, [profile.id, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function deleteArtwork(id: string) {
    if (!confirm("¿Eliminar esta obra?")) return;
    const art = artworks.find((a) => a.id === id);
    const { error } = await supabase.from("artworks").delete().eq("id", id).eq("artist_id", profile.id);
    if (error) {
      alert(error.message);
      return;
    }
    if (art?.image_url) await deleteStorageImage(art.image_url);
    loadData();
  }

  async function deleteService(id: string) {
    if (!confirm("¿Eliminar este servicio?")) return;
    const svc = services.find((s) => s.id === id);
    const { error } = await supabase.from("services").delete().eq("id", id).eq("artist_id", profile.id);
    if (error) {
      alert(error.message);
      return;
    }
    if (svc?.image_url) await deleteStorageImage(svc.image_url);
    loadData();
  }

  async function updateOrderStatus(id: string, status: string) {
    const { error } = await supabase.rpc("update_order_status", {
      p_order_id: id,
      p_new_status: status,
    });
    if (error) {
      alert(error.message);
      return;
    }
    loadData();
  }

  function handleFormSuccess() {
    setFormMode("none");
    setEditingArtwork(null);
    setEditingService(null);
    loadData();
  }

  // Form views
  if (formMode === "artwork-new" || formMode === "artwork-edit") {
    return (
      <div className="max-w-lg mx-auto">
        <h2 className="font-serif text-2xl font-medium mb-6">
          {formMode === "artwork-edit" ? "Editar obra" : "Nueva obra"}
        </h2>
        <ArtworkForm
          artistId={profile.id}
          artwork={editingArtwork}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setFormMode("none");
            setEditingArtwork(null);
          }}
        />
      </div>
    );
  }

  if (formMode === "service-new" || formMode === "service-edit") {
    return (
      <div className="max-w-lg mx-auto">
        <h2 className="font-serif text-2xl font-medium mb-6">
          {formMode === "service-edit" ? "Editar servicio" : "Nuevo servicio"}
        </h2>
        <ServiceForm
          artistId={profile.id}
          service={editingService}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setFormMode("none");
            setEditingService(null);
          }}
        />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "obras", label: "Obras", count: artworks.length },
    { id: "servicios", label: "Servicios", count: services.length },
    { id: "ordenes", label: "Órdenes", count: orders.filter((o) => o.status === "pending").length },
    { id: "perfil", label: "Mi perfil", count: 0 },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-8">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-2 rounded-full bg-accent/15 text-accent px-2 py-0.5 text-xs">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "perfil" && <ProfileForm profile={profile} />}

      {tab === "perfil" ? null : loading ? (
        <p className="text-muted text-sm py-12 text-center">Cargando…</p>
      ) : (
        <>
          {/* OBRAS */}
          {tab === "obras" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <p className="text-sm text-muted">{artworks.length} obras</p>
                <button
                  onClick={() => setFormMode("artwork-new")}
                  className="h-10 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
                >
                  + Nueva obra
                </button>
              </div>

              {artworks.length === 0 ? (
                <EmptyState
                  message="Aún no tienes obras publicadas"
                  action={() => setFormMode("artwork-new")}
                  actionLabel="Publicar primera obra"
                />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {artworks.map((art) => (
                    <div
                      key={art.id}
                      className="rounded-2xl border border-border bg-card overflow-hidden"
                    >
                      <div className="aspect-[4/5] relative bg-neutral-200 dark:bg-neutral-800">
                        {art.image_url ? (
                          <Image
                            src={art.image_url}
                            alt={art.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-30">
                            ✦
                          </div>
                        )}
                        <span
                          className={`absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            art.status === "available"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                              : art.status === "sold"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                          }`}
                        >
                          {art.status === "available"
                            ? "Disponible"
                            : art.status === "sold"
                              ? "Vendido"
                              : "Reservado"}
                        </span>
                      </div>
                      <div className="p-4">
                        <h3 className="font-medium">{art.title}</h3>
                        <p className="text-sm text-accent font-serif mt-0.5">
                          ${Number(art.price).toLocaleString("es-MX")}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => {
                              setEditingArtwork(art);
                              setFormMode("artwork-edit");
                            }}
                            className="flex-1 h-9 rounded-lg border border-border text-xs font-medium hover:bg-background"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deleteArtwork(art.id)}
                            className="h-9 px-3 rounded-lg border border-border text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SERVICIOS */}
          {tab === "servicios" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <p className="text-sm text-muted">{services.length} servicios</p>
                <button
                  onClick={() => setFormMode("service-new")}
                  className="h-10 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
                >
                  + Nuevo servicio
                </button>
              </div>

              {services.length === 0 ? (
                <EmptyState
                  message="Aún no tienes servicios publicados"
                  action={() => setFormMode("service-new")}
                  actionLabel="Publicar primer servicio"
                />
              ) : (
                <div className="grid sm:grid-cols-2 gap-6">
                  {services.map((svc) => (
                    <div
                      key={svc.id}
                      className="rounded-2xl border border-border bg-card p-5"
                    >
                      <div className="flex gap-4">
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-200 dark:bg-neutral-800">
                          {svc.image_url ? (
                            <Image
                              src={svc.image_url}
                              alt={svc.title}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xl opacity-30">
                              🎨
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium truncate">{svc.title}</h3>
                            {!svc.is_active && (
                              <span className="text-xs text-muted shrink-0">Inactivo</span>
                            )}
                          </div>
                          <p className="text-sm text-accent font-serif mt-0.5">
                            ${Number(svc.price_per_hour).toLocaleString("es-MX")}/h
                          </p>
                          {svc.description && (
                            <p className="text-xs text-muted mt-1 line-clamp-2">
                              {svc.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => {
                            setEditingService(svc);
                            setFormMode("service-edit");
                          }}
                          className="flex-1 h-9 rounded-lg border border-border text-xs font-medium hover:bg-background"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteService(svc.id)}
                          className="h-9 px-3 rounded-lg border border-border text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ÓRDENES */}
          {tab === "ordenes" && (
            <div>
              {orders.length === 0 ? (
                <EmptyState message="No hay órdenes todavía" />
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              order.status === "pending"
                                ? "bg-yellow-500"
                                : order.status === "contacted"
                                  ? "bg-blue-500"
                                  : order.status === "completed"
                                    ? "bg-green-500"
                                    : "bg-neutral-400"
                            }`}
                          />
                          <p className="font-medium">{order.client_name}</p>
                          <span className="text-xs text-muted capitalize">
                            {orderStatusLabel(order.status)}
                          </span>
                        </div>
                        <p className="text-sm text-muted mt-1">
                          📞 {order.client_phone}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {order.artwork_id ? "Obra" : "Servicio"} ·{" "}
                          {new Date(order.created_at).toLocaleDateString("es-MX")}
                        </p>
                        {order.notes && (
                          <p className="text-xs text-muted mt-1 italic">
                            &ldquo;{order.notes}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {order.client_phone && (
                          <a
                            href={`https://wa.me/${order.client_phone.replace(/[^\d+]/g, "").replace(/^\+/, "")}?text=${encodeURIComponent("Hola, te contacto por tu solicitud en Galería Viva")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-9 px-3 rounded-lg border border-border text-xs font-medium flex items-center"
                          >
                            WhatsApp
                          </a>
                        )}
                        {order.status === "pending" && (
                          <button
                            onClick={() => updateOrderStatus(order.id, "contacted")}
                            className="h-9 px-4 rounded-lg bg-foreground text-background text-xs font-medium"
                          >
                            Marcar contactado
                          </button>
                        )}
                        {order.status === "contacted" && (
                          <button
                            onClick={() => updateOrderStatus(order.id, "completed")}
                            className="h-9 px-4 rounded-lg bg-accent text-black text-xs font-medium"
                          >
                            Completar
                          </button>
                        )}
                        {(order.status === "pending" || order.status === "contacted") && (
                          <button
                            onClick={() => updateOrderStatus(order.id, "cancelled")}
                            className="h-9 px-3 rounded-lg border border-border text-xs text-muted hover:text-red-600"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({
  message,
  action,
  actionLabel,
}: {
  message: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <p className="text-muted text-sm">{message}</p>
      {action && actionLabel && (
        <button
          onClick={action}
          className="mt-4 h-10 rounded-full bg-foreground px-6 text-sm font-medium text-background"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
