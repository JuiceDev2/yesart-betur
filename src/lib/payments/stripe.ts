import { createHmac, timingSafeEqual } from "node:crypto";
import type { CheckoutInput, PaymentProvider } from "./types";

const API = "https://api.stripe.com/v1";
const API_VERSION = "2024-06-20";

/** Stripe espera application/x-www-form-urlencoded con notación de corchetes. */
export function toForm(obj: Record<string, unknown>, prefix = ""): URLSearchParams {
  const params = new URLSearchParams();
  const walk = (value: unknown, key: string) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${key}[${i}]`));
    } else if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, `${key}[${k}]`);
    } else {
      params.append(key, String(value));
    }
  };
  for (const [k, v] of Object.entries(obj)) walk(v, prefix ? `${prefix}[${k}]` : k);
  return params;
}

/**
 * Verifica el encabezado Stripe-Signature (esquema v1): HMAC-SHA256 de `${t}.${cuerpo}`.
 * Rechaza firmas viejas (tolerancia en segundos) para evitar repeticiones.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!header || !secret) return false;
  let timestamp = 0;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = Number(v);
    if (k === "v1" && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected);
  return signatures.some((sig) => {
    const buf = Buffer.from(sig);
    return buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf);
  });
}

async function stripeRequest<T>(
  method: "POST" | "DELETE",
  path: string,
  body?: URLSearchParams
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no está configurada");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": API_VERSION,
    },
    body: body?.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
  if (!res.ok) {
    const err = new Error(`Stripe ${res.status}: ${json.error?.message ?? "error"}`) as Error & { code?: string; status?: number };
    err.code = json.error?.code;
    err.status = res.status;
    throw err;
  }
  return json;
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  async createCheckout(i: CheckoutInput) {
    const metadata: Record<string, string> = {
      kind: i.kind,
      fan_id: i.fanId,
      creator_id: i.creatorId,
    };
    if (i.postId) metadata.post_id = i.postId;
    if (i.message) metadata.message = i.message.slice(0, 200);

    const productName =
      i.kind === "subscription"
        ? `Suscripción mensual a @${i.creatorUsername}`
        : i.kind === "ppv"
          ? `Publicación de @${i.creatorUsername}`
          : `Propina para @${i.creatorUsername}`;

    const priceData: Record<string, unknown> = {
      currency: i.currency.toLowerCase(),
      unit_amount: i.amountCents,
      product_data: { name: productName },
    };
    if (i.kind === "subscription") priceData.recurring = { interval: "month" };

    const form = toForm({
      mode: i.kind === "subscription" ? "subscription" : "payment",
      success_url: i.successUrl,
      cancel_url: i.cancelUrl,
      client_reference_id: i.fanId,
      customer_email: i.fanEmail ?? undefined,
      line_items: [{ price_data: priceData, quantity: 1 }],
      metadata,
      ...(i.kind === "subscription"
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata } }),
    });

    const session = await stripeRequest<{ url?: string }>("POST", "/checkout/sessions", form);
    if (!session.url) throw new Error("Stripe no devolvió la URL de pago");
    return { url: session.url };
  },

  async cancelSubscription(id, { immediately }) {
    try {
      if (immediately) {
        await stripeRequest("DELETE", `/subscriptions/${encodeURIComponent(id)}`);
      } else {
        await stripeRequest("POST", `/subscriptions/${encodeURIComponent(id)}`, toForm({ cancel_at_period_end: true }));
      }
    } catch (e) {
      const err = e as { code?: string; status?: number };
      // ya no existe / ya estaba cancelada: el objetivo está cumplido
      if (err.code === "resource_missing" || err.status === 404) return;
      throw e;
    }
  },
};
