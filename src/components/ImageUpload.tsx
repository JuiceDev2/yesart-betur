"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { extensionForType } from "@/lib/validation";

const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Sube una imagen al bucket público "avatars" (carpeta = id del usuario) y devuelve su URL. */
export default function ImageUpload({
  folder,
  currentUrl,
  onUpload,
  aspect = "aspect-square",
  label = "Subir imagen",
  className = "",
}: {
  folder: string;
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  aspect?: string;
  label?: string;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!OK_TYPES.includes(file.type)) {
      setError("Solo JPG, PNG o WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Máximo 5 MB");
      return;
    }
    setError(null);
    setUploading(true);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      const supabase = createClient();
      const name = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionForType(file.type)}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(name, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(name);
      onUpload(publicUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al subir");
      setPreview(currentUrl || null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={label}
        className={`group relative block w-full overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card ${aspect} hover:border-accent/60`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center text-muted">
            <span className="text-2xl" aria-hidden="true">＋</span>
            <span className="mt-1 text-xs">{label}</span>
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-medium">Subiendo…</span>
        )}
      </button>
      <input ref={inputRef} type="file" accept={OK_TYPES.join(",")} onChange={handleFileChange} className="hidden" />
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
