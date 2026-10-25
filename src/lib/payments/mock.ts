import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CheckoutInput, PaymentProvider } from "./types";

/**
 * Proveedor de PRUEBA: confirma el pago al instante sin cobrar nada.
 * Solo para desarrollo y CI; getPaymentProvider() lo bloquea en producción.
 */
export const mockProvider: PaymentProvider = {
  name: "mock",

  async createCheckout(i: CheckoutInput) {
    const admin = createAdminClient();
    const ref = `mock_${randomUUID()}`;
    const { data: cfg } = await admin.from("platform_settings").select("currency").maybeSingle();
    const { error } = await admin.rpc("record_payment", {
      p_provider: "mock",
      p_provider_ref: ref,
      p_provider_ref_alt: null,
      p_kind: i.kind,
      p_fan: i.fanId,
      p_creator: i.creatorId,
      p_post: i.postId ?? null,
      p_gross: i.amountCents,
      p_currency: (cfg?.currency as string | undefined) ?? i.currency,
      p_period_end:
        i.kind === "subscription" ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() : null,
      p_provider_subscription_id: i.kind === "subscription" ? `mock_sub_${randomUUID()}` : null,
      p_note: i.message ?? null,
    });
    if (error) throw new Error(error.message);
    return { url: i.successUrl };
  },

  async cancelSubscription() {
    // nada que cancelar fuera de nuestra base de datos
  },
};
