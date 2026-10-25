import { NextResponse, after } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderByName } from "@/lib/payments";
import { notifyCreatorStatus } from "@/lib/email";

const schema = z.object({
  creatorId: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { creatorId, status, reason } = parsed.data;
  if (status === "suspended" && (!reason || reason.length < 3)) {
    return NextResponse.json({ error: "Indica el motivo de la suspensión" }, { status: 400 });
  }

  const { error } = await guard.supabase.rpc("admin_set_creator_status", {
    p_creator: creatorId,
    p_status: status,
    p_reason: reason ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Al suspender se detiene el cobro de todas sus suscripciones de pago.
  const failures: string[] = [];
  if (status === "suspended") {
    const admin = createAdminClient();
    const { data: subs } = await admin
      .from("subscriptions")
      .select("provider, provider_subscription_id")
      .eq("creator_id", creatorId)
      .neq("provider", "free")
      .in("status", ["active", "canceled", "past_due"])
      .not("provider_subscription_id", "is", null);

    for (const s of subs ?? []) {
      try {
        await getProviderByName(s.provider as string).cancelSubscription(s.provider_subscription_id as string, {
          immediately: true,
        });
        await admin.rpc("set_subscription_state", {
          p_provider: s.provider,
          p_provider_subscription_id: s.provider_subscription_id,
          p_status: "expired",
          p_period_end: null,
          p_cancel_at_period_end: null,
        });
      } catch (e) {
        failures.push(String(s.provider_subscription_id));
        console.error("suspend: cancel", e instanceof Error ? e.message : e);
      }
    }
  }

  after(async () => {
    try {
      await notifyCreatorStatus({ creatorId, active: status === "active", reason });
    } catch (e) {
      console.error("notifyCreatorStatus", e);
    }
  });
  return NextResponse.json({ ok: true, cancelFailures: failures });
}
