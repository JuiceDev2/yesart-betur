"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface ImageUploadProps {
  bucket?: string;
  folder?: string;
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  className?: string;
}

export default function ImageUpload({
  bucket = "artworks",
  folder = "",
  currentUrl,
  onUpload,
  className = "",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Máximo 5 MB");
      return;
    }

    setError(null);
    setUploading(true);

    // Local preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const fileName = `${folder ? folder + "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(fileName);

      onUpload(publicUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al subir";
      setError(message);
      setPreview(currentUrl || null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      <div
        onClick={() => inputRef.current?.click()}
        className="relative aspect-[4/3] rounded-xl border-2 border-dashed border-border bg-background cursor-pointer overflow-hidden hover:border-accent/50 transition-colors group"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Preview"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
            <span className="text-3xl mb-2">📷</span>
            <span className="text-sm">Click para subir imagen</span>
            <span className="text-xs mt-1">JPG, PNG · máx 5 MB</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-sm font-medium">Subiendo…</span>
          </div>
        )}

        {preview && !uploading && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-sm font-medium">Cambiar imagen</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
