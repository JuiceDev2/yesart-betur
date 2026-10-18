import { createClient } from "@/lib/supabase/client";

/** Extract storage path from a public Supabase URL and remove the file. */
export async function deleteStorageImage(publicUrl: string | null | undefined) {
  if (!publicUrl) return;
  try {
    const marker = "/storage/v1/object/public/artworks/";
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const path = publicUrl.slice(idx + marker.length);
    if (!path) return;
    const supabase = createClient();
    await supabase.storage.from("artworks").remove([path]);
  } catch (e) {
    console.error("deleteStorageImage", e);
  }
}
