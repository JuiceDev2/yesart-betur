import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderByName } from "@/lib/payments";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ confirm: z.literal("ELIMINAR") });

type Admin = ReturnType<typeof createAdminClient>;

/** Borra todos los archivos de una carpeta {uid}/... de un bucket (best-effort, por páginas). */
async function purgeFolder(admin: Admin, bucket: string, folder: string) {
  const walk = async (prefix: string): Promise<string[]> => {
    const out: string[] = [];
    const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (item.id) out.push(path);
      else out.push(...(await walk(path)));
    }
    return out;
  };
  const paths = await walk(folder);
  for (let i = 0; i < paths.length; i += 100) {
    await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
  }
}

/**
 * Elimina la cuenta del usuario autenticado, en un orden que nunca deja cobros huérfanos:
 *  1. Validaciones (confirmación, último admin, saldo o retiro pendiente de un creador).
 *  2. Se cancelan los cobros automáticos (los suyos y, si es creador, los de sus suscriptores).
 *     Si el proveedor falla, se aborta ANTES de borrar nada.
 *  3. Limpieza de archivos en Storage (best-effort).
 *  4. Se borra el usuario de Auth; el perfil y su contenido caen en cascada. El libro de
 *     transacciones se conserva por obligaciones contables, sin vínculo a la persona.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!bodySchema.safeParse(await request.json().catch(() => null)).success) {
    return NextResponse.json({ error: "Escribe ELIMINAR para confirmar" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role === "admin") {
    const { count } = await admin
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

  if (profile?.role === "creator") {
    const { data: bal } = await admin.rpc("creator_balance", { p_creator: user.id });
    const b = Array.isArray(bal) ? bal[0] : bal;
    if (b && (Number(b.available_cents) > 0 || Number(b.hold_cents) > 0 || Number(b.pending_payout_cents) > 0)) {
      return NextResponse.json(
        { error: "Tienes saldo o retiros pendientes. Retira tu saldo (o espera a que se libere) antes de eliminar tu cuenta." },
        { status: 409 }
      );
    }
  }

  // Cobros automáticos a cancelar: como fan y, si es creador, de todos sus suscriptores
  const { data: subs } = await admin
    .from("subscriptions")
    .select("provider, provider_subscription_id")
    .or(`fan_id.eq.${user.id},creator_id.eq.${user.id}`)
    .neq("provider", "free")
    .not("provider_subscription_id", "is", null);

  try {
    for (const s of subs ?? []) {
      await getProviderByName(s.provider as string).cancelSubscription(s.provider_subscription_id as string, {
        immediately: true,
      });
    }
  } catch (e) {
    console.error("account delete: cancel", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "No pudimos cancelar tus suscripciones activas. No se eliminó nada; intenta de nuevo." },
      { status: 502 }
    );
  }

  for (const bucket of ["media", "avatars", "kyc"]) {
    try {
      await purgeFolder(admin, bucket, user.id);
    } catch (e) {
      console.error("purge", bucket, e instanceof Error ? e.message : e);
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("deleteUser", deleteError.message);
    return NextResponse.json(
      { error: "No se pudo eliminar la cuenta. Intenta de nuevo o contacta a soporte." },
      { status: 500 }
    );
  }

  await supabase.auth.signOut().catch(() => null);
  return NextResponse.json({ ok: true });
}
