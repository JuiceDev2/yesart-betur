import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeSignature } from "@/lib/payments/stripe";
import { handleStripeEvent, type StripeEvent } from "@/lib/payments/webhook";
import { notifyCreatorSale } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe
 * Configura en Stripe un endpoint con los eventos: checkout.session.completed,
 * checkout.session.async_payment_succeeded, invoice.paid, invoice.payment_failed,
 * customer.subscription.updated, customer.subscription.deleted, charge.refunded,
 * charge.dispute.created. Todo es idempotente: Stripe puede reintentar sin duplicar cobros.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook no configurado" }, { status: 500 });

  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event, createAdminClient());
    if (result.sales.length > 0) {
      after(async () => {
        for (const s of result.sales) {
          try {
            await notifyCreatorSale(s);
          } catch (e) {
            console.error("notifyCreatorSale", e);
          }
        }
      });
    }
    return NextResponse.json({ received: true, handled: result.handled, detail: result.detail });
  } catch (e) {
    console.error("stripe webhook", event.type, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Error procesando el evento" }, { status: 500 });
  }
}
