import { createClient } from "@/lib/supabase/client";

const MARKER = "/storage/v1/object/public/avatars/";

/** Borra del bucket público "avatars" el archivo al que apunta una URL pública (best-effort). */
export async function deleteAvatarFile(publicUrl: string | null | undefined) {
  if (!publicUrl) return;
  try {
    const idx = publicUrl.indexOf(MARKER);
    if (idx === -1) return;
    const path = publicUrl.slice(idx + MARKER.length);
    if (!path) return;
    await createClient().storage.from("avatars").remove([path]);
  } catch (e) {
    console.error("deleteAvatarFile", e);
  }
}
