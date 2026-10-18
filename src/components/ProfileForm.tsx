"use client";

import { useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { deleteStorageImage } from "@/lib/storage";
import ImageUpload from "./ImageUpload";
import type { Profile } from "@/types";

const schema = z.object({
  full_name: z.string().trim().min(2, "Escribe tu nombre").max(120, "Máximo 120 caracteres"),
  phone: z
    .string()
    .trim()
    .max(30, "Máximo 30 caracteres")
    .regex(/^[+\d\s()-]*$/, "Solo números, espacios, + ( ) -")
    .optional(),
  bio: z.string().trim().max(1000, "Máximo 1000 caracteres").optional(),
});

/**
 * Perfil público del artista: nombre, bio y foto. Es lo que ve el cliente en
 * /a/[id] y en las tarjetas. Solo escribe columnas permitidas por la base de
 * datos (el trigger protege role / is_active / email).
 */
export default function ProfileForm({ profile }: { profile: Profile }) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [savedAvatar, setSavedAvatar] = useState(profile.avatar_url ?? "");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    const parsed = schema.safeParse({ full_name: fullName, phone, bio });
    if (!parsed.success) {
      setFeedback({ type: "err", text: parsed.error.issues[0]?.message || "Datos inválidos" });
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || null,
        bio: parsed.data.bio || null,
        avatar_url: avatarUrl || null,
      })
      .eq("id", profile.id);

    if (error) {
      setFeedback({ type: "err", text: error.message });
      setLoading(false);
      return;
    }

    // Si cambió la foto, se borra la anterior de Storage (best effort).
    if (savedAvatar && savedAvatar !== avatarUrl) {
      await deleteStorageImage(savedAvatar);
    }
    setSavedAvatar(avatarUrl);
    setFeedback({ type: "ok", text: "Perfil actualizado" });
    setLoading(false);
  }

  const input =
    "w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40";

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium">Foto de perfil</p>
        <ImageUpload
          folder={profile.id}
          currentUrl={avatarUrl || null}
          onUpload={setAvatarUrl}
        />
      </div>

      <div>
        <label htmlFor="pf-name" className="mb-1.5 block text-sm font-medium">
          Nombre artístico *
        </label>
        <input
          id="pf-name"
          required
          minLength={2}
          maxLength={120}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={`${input} h-11`}
        />
      </div>

      <div>
        <label htmlFor="pf-phone" className="mb-1.5 block text-sm font-medium">
          Teléfono (privado)
        </label>
        <input
          id="pf-phone"
          type="tel"
          inputMode="tel"
          maxLength={30}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={`${input} h-11`}
        />
        <p className="mt-1 text-xs text-muted">Solo lo ve el equipo de la galería.</p>
      </div>

      <div>
        <label htmlFor="pf-bio" className="mb-1.5 block text-sm font-medium">
          Sobre ti (aparece en tu página pública)
        </label>
        <textarea
          id="pf-bio"
          rows={5}
          maxLength={1000}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className={`${input} py-3`}
        />
        <p className="mt-1 text-right text-xs text-muted">{bio.length}/1000</p>
      </div>

      {feedback && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            feedback.type === "ok"
              ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/30"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-full bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Guardando…" : "Guardar perfil"}
      </button>
    </form>
  );
}
