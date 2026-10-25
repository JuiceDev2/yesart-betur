import type { RpcClient } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface StripeEvent {
  id: string;
  type: string;
  data: { object: any };
}

export interface SaleInfo {
  kind: "subscription" | "renewal" | "ppv" | "tip";
  creatorId: string;
  fanId: string;
  grossCents: number;
  currency: string;
}

export interface WebhookResult {
  handled: boolean;
  detail?: string;
  sales: SaleInfo[];
}

const PROVIDER = "stripe";

function iso(unixSeconds: unknown): string | null {
  const n = Number(unixSeconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v) return v;
  if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") return (v as { id: string }).id;
  return null;
}

async function call(db: RpcClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

async function refundByCandidates(db: RpcClient, refs: Array<string | null>): Promise<boolean> {
  for (const ref of refs) {
    if (!ref) continue;
    const done = await call(db, "record_refund", { p_provider: PROVIDER, p_ref: ref });
    if (done === true) return true;
  }
  return false;
}

/**
 * Traduce un evento de Stripe a llamadas SQL idempotentes. Si algo falla lanza una
 * excepción (el webhook responde 500 y Stripe reintenta); repetir un evento es seguro.
 */
export async function handleStripeEvent(event: StripeEvent, db: RpcClient): Promise<WebhookResult> {
  const obj = event.data?.object ?? {};
  const sales: SaleInfo[] = [];

  switch (event.type) {
    // Pagos únicos: publicaciones de pago y propinas
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (obj.mode !== "payment") return { handled: false, detail: "las suscripciones se registran con invoice.paid", sales };
      if (obj.payment_status !== "paid") return { handled: false, detail: "pago aún no confirmado", sales };
      const md = obj.metadata ?? {};
      const kind = md.kind as string | undefined;
      if ((kind !== "ppv" && kind !== "tip") || !md.fan_id || !md.creator_id) {
        return { handled: false, detail: "sesión sin metadatos de Aura", sales };
      }
      const ref = str(obj.payment_intent) ?? str(obj.id);
      const gross = Number(obj.amount_total);
      const currency = String(obj.currency ?? "mxn").toUpperCase();
      const id = await call(db, "record_payment", {
        p_provider: PROVIDER, p_provider_ref: ref, p_provider_ref_alt: null, p_kind: kind,
        p_fan: md.fan_id, p_creator: md.creator_id, p_post: md.post_id ?? null,
        p_gross: gross, p_currency: currency, p_period_end: null,
        p_provider_subscription_id: null, p_note: md.message ?? null,
      });
      if (id) sales.push({ kind, creatorId: md.creator_id, fanId: md.fan_id, grossCents: gross, currency });
      return { handled: true, detail: id ? "pago registrado" : "ya registrado", sales };
    }

    // Suscripciones: primer cobro y renovaciones
    case "invoice.paid": {
      const subId = str(obj.subscription) ?? str(obj.parent?.subscription_details?.subscription);
      const md =
        obj.subscription_details?.metadata ??
        obj.parent?.subscription_details?.metadata ??
        obj.lines?.data?.[0]?.metadata ??
        {};
      const gross = Number(obj.amount_paid);
      if (!subId || !(gross > 0)) return { handled: false, detail: "factura sin cobro de suscripción", sales };
      if (!md.fan_id || !md.creator_id) return { handled: false, detail: "factura sin metadatos de Aura", sales };

      const periodEnd = iso(obj.lines?.data?.[0]?.period?.end);
      if (!periodEnd) throw new Error("invoice.paid sin fin de periodo");
      const kind = obj.billing_reason === "subscription_create" ? "subscription" : "renewal";
      const currency = String(obj.currency ?? "mxn").toUpperCase();
      const id = await call(db, "record_payment", {
        p_provider: PROVIDER, p_provider_ref: obj.id,
        p_provider_ref_alt: str(obj.charge) ?? str(obj.payment_intent),
        p_kind: kind, p_fan: md.fan_id, p_creator: md.creator_id, p_post: null,
        p_gross: gross, p_currency: currency, p_period_end: periodEnd,
        p_provider_subscription_id: subId, p_note: null,
      });
      if (id) sales.push({ kind, creatorId: md.creator_id, fanId: md.fan_id, grossCents: gross, currency });
      return { handled: true, detail: id ? "cobro registrado" : "ya registrado", sales };
    }

    case "invoice.payment_failed": {
      const subId = str(obj.subscription) ?? str(obj.parent?.subscription_details?.subscription);
      if (!subId) return { handled: false, detail: "sin suscripción", sales };
      await call(db, "set_subscription_state", {
        p_provider: PROVIDER, p_provider_subscription_id: subId, p_status: "past_due",
        p_period_end: null, p_cancel_at_period_end: null,
      });
      return { handled: true, sales };
    }

    case "customer.subscription.updated": {
      const id = str(obj.id);
      if (!id) return { handled: false, sales };
      const periodEnd = iso(obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end);
      let status: string | null = null;
      if (obj.status === "active" || obj.status === "trialing") status = obj.cancel_at_period_end ? "canceled" : "active";
      else if (obj.status === "past_due" || obj.status === "unpaid") status = "past_due";
      else if (obj.status === "canceled") status = "expired";
      if (!status) return { handled: false, detail: `estado ${obj.status} ignorado`, sales };
      await call(db, "set_subscription_state", {
        p_provider: PROVIDER, p_provider_subscription_id: id, p_status: status,
        p_period_end: periodEnd, p_cancel_at_period_end: Boolean(obj.cancel_at_period_end),
      });
      return { handled: true, sales };
    }

    case "customer.subscription.deleted": {
      const id = str(obj.id);
      if (!id) return { handled: false, sales };
      await call(db, "set_subscription_state", {
        p_provider: PROVIDER, p_provider_subscription_id: id, p_status: "expired",
        p_period_end: null, p_cancel_at_period_end: null,
      });
      return { handled: true, sales };
    }

    // Reembolsos totales y contracargos: se revoca el acceso que dio esa venta
    case "charge.refunded": {
      if (obj.refunded !== true) return { handled: false, detail: "reembolso parcial: revisar manualmente", sales };
      const done = await refundByCandidates(db, [str(obj.invoice), str(obj.id), str(obj.payment_intent)]);
      return { handled: true, detail: done ? "revocado" : "sin transacción asociada", sales };
    }
    case "charge.dispute.created": {
      const done = await refundByCandidates(db, [str(obj.charge), str(obj.payment_intent)]);
      return { handled: true, detail: done ? "revocado por disputa" : "sin transacción asociada", sales };
    }

    default:
      return { handled: false, detail: "evento ignorado", sales };
  }
}
