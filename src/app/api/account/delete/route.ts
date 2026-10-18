import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({ confirm: z.literal("ELIMINAR") });

/**
 * Elimina la cuenta del usuario autenticado.
 *
 * Orden pensado para que NUNCA quede una cuenta "a medias":
 *  1. Validaciones (confirmación, último admin).
 *  2. Se anotan las órdenes donde era cliente (para anonimizarlas después).
 *  3. Se borra el usuario de Auth (el perfil, obras y servicios caen en cascada;
 *     las órdenes conservan su historial con artist_id / client_user_id en NULL).
 *  4. Limpieza best-effort: imágenes en Storage y datos personales en órdenes.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe ELIMINAR para confirmar" }, { status: 400 });
  }

  const service = createAdminClient();

  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") {
    const { count } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true)
      .neq("id", user.id);
    if (!count || count < 1) {
      return NextResponse.json(
        { error: "Eres el último administrador activo. Designa a otro antes de eliminar tu cuenta." },
        { status: 409 }
      );
    }
  }

  const { data: ownOrders } = await service
    .from("orders")
    .select("id")
    .eq("client_user_id", user.id);
  const orderIds = (ownOrders || []).map((o) => o.id as string);

  const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("deleteUser", deleteError.message);
    return NextResponse.json(
      { error: "No se pudo eliminar la cuenta. Intenta de nuevo o contacta a soporte." },
      { status: 500 }
    );
  }

  // --- Limpieza best-effort (la cuenta ya no existe) ---
  try {
    if (orderIds.length > 0) {
      const { error } = await service
        .from("orders")
        .update({
          client_name: "Cuenta eliminada",
          client_phone: "0000000",
          notes: null,
        })
        .in("id", orderIds);
      if (error) console.error("anonymize orders", error.message);
    }
  } catch (e) {
    console.error("anonymize orders", e);
  }

  try {
    const bucket = service.storage.from("artworks");
    for (let i = 0; i < 20; i++) {
      const { data: files } = await bucket.list(user.id, { limit: 100 });
      if (!files || files.length === 0) break;
      await bucket.remove(files.map((f) => `${user.id}/${f.name}`));
      if (files.length < 100) break;
    }
  } catch (e) {
    console.error("storage cleanup", e);
  }

  await supabase.auth.signOut().catch(() => null);
  return NextResponse.json({ success: true });
}
