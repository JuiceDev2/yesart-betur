import { createClient } from "@/lib/supabase/server";
import { escapeFilterValue } from "@/lib/filters";
import type { PublicCreator } from "@/types";

export const EXPLORE_PAGE_SIZE = 24;

export async function getCurrency(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("platform_settings").select("currency").maybeSingle();
    return (data?.currency as string | undefined) ?? "MXN";
  } catch {
    return "MXN";
  }
}

export async function getFeaturedCreators(limit = 8): Promise<PublicCreator[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("public_creators")
      .select("*")
      .gt("post_count", 0)
      .order("last_post_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    return (data as PublicCreator[] | null) ?? [];
  } catch {
    return [];
  }
}

export async function searchCreators(opts: {
  q?: string;
  category?: string;
  hideAdult?: boolean;
  page?: number;
}): Promise<{ rows: PublicCreator[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const from = (page - 1) * EXPLORE_PAGE_SIZE;

  let query = supabase
    .from("public_creators")
    .select("*", { count: "exact" })
    .order("last_post_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + EXPLORE_PAGE_SIZE - 1);

  const q = escapeFilterValue(opts.q ?? "");
  if (q) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.hideAdult) query = query.eq("is_nsfw", false);

  const { data, count } = await query;
  return { rows: (data as PublicCreator[] | null) ?? [], total: count ?? 0 };
}
