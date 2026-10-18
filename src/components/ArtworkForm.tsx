"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "./ImageUpload";
import type { Artwork } from "@/types";

interface ArtworkFormProps {
  artistId: string;
  artwork?: Artwork | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ArtworkForm({
  artistId,
  artwork,
  onSuccess,
  onCancel,
}: ArtworkFormProps) {
  const [title, setTitle] = useState(artwork?.title || "");
  const [description, setDescription] = useState(artwork?.description || "");
  const [price, setPrice] = useState(artwork?.price?.toString() || "");
  const [category, setCategory] = useState(artwork?.category || "");
  const [imageUrl, setImageUrl] = useState(artwork?.image_url || "");
  const [status, setStatus] = useState(artwork?.status || "available");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!artwork;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      price: parseFloat(price),
      category: category.trim() || null,
      image_url: imageUrl || null,
      status,
      artist_id: artistId,
    };

    let result;
    if (isEdit) {
      result = await supabase
        .from("artworks")
        .update(payload)
        .eq("id", artwork.id)
        .eq("artist_id", artistId);
    } else {
      result = await supabase.from("artworks").insert(payload);
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
          placeholder="Nombre de la obra"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/40 resize-none"
          placeholder="Técnica, dimensiones, historia..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Precio (MXN) *</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="1500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Categoría</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="Pintura, Escultura..."
          />
        </div>
      </div>

      {isEdit && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "available" | "sold" | "reserved")}
            className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="available">Disponible</option>
            <option value="reserved">Reservado</option>
            <option value="sold">Vendido</option>
          </select>
        </div>
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
          {loading ? "Guardando…" : isEdit ? "Actualizar" : "Publicar obra"}
        </button>
      </div>
    </form>
  );
}
