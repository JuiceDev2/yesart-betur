"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "./ImageUpload";
import type { Service } from "@/types";

interface ServiceFormProps {
  artistId: string;
  service?: Service | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ServiceForm({
  artistId,
  service,
  onSuccess,
  onCancel,
}: ServiceFormProps) {
  const [title, setTitle] = useState(service?.title || "");
  const [description, setDescription] = useState(service?.description || "");
  const [pricePerHour, setPricePerHour] = useState(
    service?.price_per_hour?.toString() || ""
  );
  const [imageUrl, setImageUrl] = useState(service?.image_url || "");
  const [isActive, setIsActive] = useState(service?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!service;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      price_per_hour: parseFloat(pricePerHour),
      image_url: imageUrl || null,
      is_active: isActive,
      artist_id: artistId,
    };

    let result;
    if (isEdit) {
      result = await supabase
        .from("services")
        .update(payload)
        .eq("id", service.id)
        .eq("artist_id", artistId);
    } else {
      result = await supabase.from("services").insert(payload);
    }

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <ImageUpload
        folder={artistId}
        currentUrl={imageUrl}
        onUpload={setImageUrl}
      />

      <div>
        <label className="block text-sm font-medium mb-1.5">Título *</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          placeholder="Mural residencial, Ilustración a medida..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/40 resize-none"
          placeholder="Qué incluye, estilos, tiempos estimados..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Precio por hora (MXN) *
        </label>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={pricePerHour}
          onChange={(e) => setPricePerHour(e.target.value)}
          className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          placeholder="45"
        />
      </div>

      {isEdit && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm">Servicio activo (visible en catálogo)</span>
        </label>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 rounded-full border border-border text-sm font-medium hover:bg-background transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 h-11 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Guardando…" : isEdit ? "Actualizar" : "Publicar servicio"}
        </button>
      </div>
    </form>
  );
}
