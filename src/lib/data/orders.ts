import { createClient } from "@/lib/supabase/server";
import type { Order, PublicArtist } from "@/types";

export async function getClientOrders(userId: string): Promise<Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, artwork:artworks(id, title, image_url, price), service:services(id, title, image_url, price_per_hour)"
    )
    .eq("client_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getClientOrders", error.message);
    return [];
  }

  const orders = (data || []) as Order[];
  if (orders.length === 0) return orders;

  const artistIds = [...new Set(orders.map((o) => o.artist_id))];
  const { data: artists } = await supabase
    .from("public_artists")
    .select("id, full_name, avatar_url, bio, created_at")
    .in("id", artistIds);

  const map = new Map<string, PublicArtist>();
  (artists || []).forEach((a) => map.set(a.id, a as PublicArtist));

  return orders.map((o) => ({
    ...o,
    artist: map.get(o.artist_id) || null,
  }));
}

export async function getAdminMetrics() {
  const supabase = await createClient();

  const [
    artistsActive,
    artistsPending,
    artworks,
    services,
    ordersPending,
    ordersTotal,
    appsPending,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "artist")
      .eq("is_active", true),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "artist")
      .eq("is_active", false),
    supabase
      .from("artworks")
      .select("id", { count: "exact", head: true })
      .eq("is_hidden", false),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("is_hidden", false),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase
      .from("artist_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return {
    artistsActive: artistsActive.count || 0,
    artistsPending: artistsPending.count || 0,
    artworks: artworks.count || 0,
    services: services.count || 0,
    ordersPending: ordersPending.count || 0,
    ordersTotal: ordersTotal.count || 0,
    appsPending: appsPending.count || 0,
  };
}
