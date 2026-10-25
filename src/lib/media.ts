import { createClient } from "@/lib/supabase/client";

/**
 * Firma URLs temporales de archivos del bucket privado "media". La base de datos solo
 * firma los que el usuario puede ver (política de Storage basada en can_view_post).
 */
export async function signPaths(paths: string[], seconds = 3600): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("media").createSignedUrls(paths, seconds);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}
