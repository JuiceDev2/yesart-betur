import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { blockSchema } from "@/lib/validation";
import { getProviderByName } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** Un creador bloquea (o desbloquea) a un fan: pierde el acceso y se deja de cobrar su suscripción. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = blockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { fanId, blocked } = parsed.data;
  if (fanId === user.id) return NextResponse.json({ error: "No puedes bloquearte a ti mismo" }, { status: 400 });

  if (!blocked) {
    const { error } = await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", fanId);
    if (error) return NextResponse.json({ error: "No se pudo desbloquear" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // La política RLS exige ser un creador activo
  const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: fanId });
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "No se pudo bloquear" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("provider, provider_subscription_id")
    .eq("fan_id", fanId)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (sub && sub.provider !== "free" && sub.provider_subscription_id) {
    try {
      await getProviderByName(sub.provider as string).cancelSubscription(sub.provider_subscription_id as string, {
        immediately: true,
      });
      await admin.rpc("set_subscription_state", {
        p_provider: sub.provider,
        p_provider_subscription_id: sub.provider_subscription_id,
        p_status: "expired",
        p_period_end: null,
        p_cancel_at_period_end: null,
      });
    } catch (e) {
      console.error("block: cancel subscription", e instanceof Error ? e.message : e);
      return NextResponse.json(
        { ok: true, warning: "Bloqueado, pero no pudimos cancelar su cobro automático. Contacta a soporte." },
        { status: 200 }
      );
    }
  }
  return NextResponse.json({ ok: true });
}
