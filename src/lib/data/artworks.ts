import { createClient } from "@/lib/supabase/server";
import { escapeFilterValue } from "@/lib/filters";
import type { Artwork, GalleryFilters, PublicArtist } from "@/types";

const PAGE_SIZE = 12;



async function attachArtists(items: Artwork[]): Promise<Artwork[]> {
  if (items.length === 0) return items;
  const ids = [...new Set(items.map((i) => i.artist_id))];
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_artists")
    .select("id, full_name, avatar_url, bio, created_at")
    .in("id", ids);
  const map = new Map<string, PublicArtist>();
  (data || []).forEach((a) => map.set(a.id, a as PublicArtist));
  return items.map((item) => ({
    ...item,
    artist: map.get(item.artist_id) || null,
  }));
}

export async function getFeaturedArtworks(limit = 3): Promise<Artwork[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artworks")
    .select("*")
    .eq("status", "available")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getFeaturedArtworks", error.message);
    return [];
  }
  return attachArtists((data || []) as Artwork[]);
}

export async function listArtworks(filters: GalleryFilters = {}): Promise<{
  items: Artwork[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page || 1);
  const pageSize = filters.pageSize || PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("artworks")
    .select("*", { count: "exact" })
    .eq("status", "available")
    .eq("is_hidden", false);

  if (filters.q) {
    const q = escapeFilterValue(filters.q);
    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }
  }
  if (filters.category) {
    // Exact match: only trim and length-limit (do NOT escapeFilterValue — breaks _, %, .)
    const cat = filters.category.trim().slice(0, 80);
    if (cat) query = query.eq("category", cat);
  }
  if (filters.minPrice != null) query = query.gte("price", filters.minPrice);
  if (filters.maxPrice != null) query = query.lte("price", filters.maxPrice);
  if (filters.artistId) query = query.eq("artist_id", filters.artistId);

  switch (filters.sort) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("listArtworks", error.message);
    return { items: [], total: 0, page, pageSize };
  }

  const items = await attachArtists((data || []) as Artwork[]);
  return { items, total: count || 0, page, pageSize };
}

export async function getArtworkById(id: string): Promise<Artwork | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artworks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getArtworkById", error.message);
    return null;
  }
  const [withArtist] = await attachArtists([data as Artwork]);
  return withArtist;
}
