import { createClient } from "@/lib/supabase/server";
import type { PublicArtist } from "@/types";

/**
 * Artistas activos más recientes (solo datos públicos: la vista public_artists
 * nunca expone correo ni teléfono). Devuelve [] si hay un error.
 */
export async function getFeaturedArtists(limit = 4): Promise<PublicArtist[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_artists")
    .select("id, full_name, avatar_url, bio, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getFeaturedArtists", error.message);
    return [];
  }
  return (data || []) as PublicArtist[];
}
