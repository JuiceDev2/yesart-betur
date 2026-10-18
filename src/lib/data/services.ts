import { createClient } from "@/lib/supabase/server";
import { escapeFilterValue } from "@/lib/filters";
import type { Service, GalleryFilters, PublicArtist } from "@/types";

const PAGE_SIZE = 12;



async function attachArtists(items: Service[]): Promise<Service[]> {
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

export async function getFeaturedServices(limit = 3): Promise<Service[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getFeaturedServices", error.message);
    return [];
  }
  return attachArtists((data || []) as Service[]);
}

export async function listServices(filters: GalleryFilters = {}): Promise<{
  items: Service[];
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
    .from("services")
    .select("*", { count: "exact" })
    .eq("is_active", true)
    .eq("is_hidden", false);

  if (filters.q) {
    const q = escapeFilterValue(filters.q);
    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }
  }
  if (filters.artistId) query = query.eq("artist_id", filters.artistId);

  switch (filters.sort) {
    case "price_asc":
      query = query.order("price_per_hour", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price_per_hour", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("listServices", error.message);
    return { items: [], total: 0, page, pageSize };
  }

  const items = await attachArtists((data || []) as Service[]);
  return { items, total: count || 0, page, pageSize };
}

export async function getServiceById(id: string): Promise<Service | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getServiceById", error.message);
    return null;
  }
  const [withArtist] = await attachArtists([data as Service]);
  return withArtist;
}
