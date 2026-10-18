import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/gallery`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const supabase = await createClient();
    const [arts, svcs, artists] = await Promise.all([
      supabase
        .from("artworks")
        .select("id, updated_at, created_at")
        .eq("status", "available")
        .eq("is_hidden", false)
        .limit(500),
      supabase
        .from("services")
        .select("id, updated_at, created_at")
        .eq("is_active", true)
        .eq("is_hidden", false)
        .limit(500),
      supabase.from("public_artists").select("id, created_at").limit(500),
    ]);

    const artRoutes =
      arts.data?.map((a) => ({
        url: `${base}/artwork/${a.id}`,
        lastModified: new Date(a.updated_at || a.created_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })) || [];

    const svcRoutes =
      svcs.data?.map((s) => ({
        url: `${base}/service/${s.id}`,
        lastModified: new Date(s.updated_at || s.created_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })) || [];

    const artistRoutes =
      artists.data?.map((a) => ({
        url: `${base}/a/${a.id}`,
        lastModified: new Date(a.created_at),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })) || [];

    return [...staticRoutes, ...artRoutes, ...svcRoutes, ...artistRoutes];
  } catch {
    return staticRoutes;
  }
}
