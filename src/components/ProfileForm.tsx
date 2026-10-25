"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ImageUpload";
import { createClient } from "@/lib/supabase/client";
import { deleteAvatarFile } from "@/lib/storage";
import { profileSchema } from "@/lib/validation";
import type { Profile } from "@/types";

const input =
  "h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40";

export default function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [banner, setBanner] = useState(profile.banner_url);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const parsed = profileSchema.safeParse({ displayName, username, bio });
    if (!parsed.success) {
      setMsg({ ok: false, text: parsed.error.issues[0]?.message ?? "Datos inválidos" });
      return;
    }
    setSaving(true);
    const { error } = await createClient()
      .from("profiles")
      .update({
        display_name: parsed.data.displayName,
        username: parsed.data.username,
        bio: parsed.data.bio || null,
        avatar_url: avatar,
        banner_url: banner,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      setMsg({
        ok: false,
        text: error.code === "23505" ? "Ese nombre de usuario ya está en uso" : "No se pudo guardar. Intenta de nuevo.",
      });
      return;
    }
    if (profile.avatar_url && profile.avatar_url !== avatar) void deleteAvatarFile(profile.avatar_url);
    if (profile.banner_url && profile.banner_url !== banner) void deleteAvatarFile(profile.banner_url);
    setMsg({ ok: true, text: "Cambios guardados" });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <div>
          <p className="mb-1.5 text-sm font-medium">Foto</p>
          <ImageUpload folder={profile.id} currentUrl={avatar} onUpload={setAvatar} label="Subir foto" />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Portada</p>
          <ImageUpload folder={profile.id} currentUrl={banner} onUpload={setBanner} aspect="aspect-[3/1]" label="Subir portada" />
        </div>
      </div>

      <div>
        <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium">Nombre público</label>
        <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className={input} />
      </div>
      <div>
        <label htmlFor="username" className="mb-1.5 block text-sm font-medium">Usuario</label>
        <div className="flex items-center rounded-xl border border-border bg-card focus-within:ring-2 focus-within:ring-accent/40">
          <span className="pl-4 text-sm text-muted">@</span>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            maxLength={24}
            className="h-11 w-full bg-transparent px-1 pr-4 text-sm outline-none"
          />
        </div>
        <p className="mt-1 text-xs text-muted">3 a 24 caracteres: minúsculas, números y guion bajo.</p>
      </div>
      <div>
        <label htmlFor="bio" className="mb-1.5 block text-sm font-medium">Biografía</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={1000}
          rows={4}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>
          {msg.text}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="h-11 rounded-full bg-accent px-8 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
