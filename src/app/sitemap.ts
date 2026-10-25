import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/explore`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/content-policy`, changeFrequency: "yearly", priority: 0.3 },
  ];
  try {
    const supabase = await createClient();
    // Solo perfiles sin contenido para adultos: los +18 no se promueven en buscadores.
    const { data } = await supabase
      .from("public_creators")
      .select("username, last_post_at, created_at")
      .eq("is_nsfw", false)
      .limit(1000);
    const creators: MetadataRoute.Sitemap = (data ?? []).map((c) => ({
      url: `${base}/c/${c.username}`,
      lastModified: new Date((c.last_post_at as string | null) ?? (c.created_at as string)),
      changeFrequency: "weekly",
      priority: 0.6,
    }));
    return [...staticRoutes, ...creators];
  } catch {
    return staticRoutes;
  }
}
