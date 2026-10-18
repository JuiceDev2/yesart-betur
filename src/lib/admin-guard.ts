import { createClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type AdminGuard =
  | { ok: true; userId: string; supabase: ServerSupabase }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Verifica en el servidor que quien llama es un administrador ACTIVO.
 * Úsalo al inicio de cada ruta /api/admin/*. La base de datos vuelve a
 * comprobarlo con RLS / is_admin(), esto es la primera barrera.
 */
export async function requireAdminApi(): Promise<AdminGuard> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, status: 401, error: "No autorizado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || profile.is_active !== true) {
    return { ok: false, status: 403, error: "Solo administradores" };
  }

  return { ok: true, userId: user.id, supabase };
}
