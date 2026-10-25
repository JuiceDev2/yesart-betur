import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelSubscriptionSchema } from "@/lib/validation";
import { getProviderByName } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** Cancela la renovación; el acceso continúa hasta el fin del periodo ya pagado. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = cancelSubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, provider, provider_subscription_id")
    .eq("fan_id", user.id)
    .eq("creator_id", parsed.data.creatorId)
    .maybeSingle();
  if (!sub) return NextResponse.json({ error: "No tienes una suscripción con este creador" }, { status: 404 });

  if (sub.provider === "free") {
    const { error } = await supabase.rpc("unfollow_creator", { p_creator: parsed.data.creatorId });
    if (error) return NextResponse.json({ error: "No se pudo dejar de seguir" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  try {
    if (sub.provider_subscription_id) {
      await getProviderByName(sub.provider as string).cancelSubscription(sub.provider_subscription_id as string, {
        immediately: false,
      });
    }
    const admin = createAdminClient();
    const { error } = await admin.rpc("set_subscription_state", {
      p_provider: sub.provider,
      p_provider_subscription_id: sub.provider_subscription_id,
      p_status: "canceled",
      p_period_end: null,
      p_cancel_at_period_end: true,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("cancel subscription", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos cancelar la suscripción. Intenta de nuevo." }, { status: 502 });
  }
}
