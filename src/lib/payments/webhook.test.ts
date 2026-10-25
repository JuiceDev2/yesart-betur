import { describe, it, expect } from "vitest";
import { handleStripeEvent, type StripeEvent } from "./webhook";
import type { RpcClient } from "./types";

function fakeDb(returns: Record<string, unknown> = {}, fail?: string) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const db: RpcClient = {
    async rpc(fn, args = {}) {
      calls.push({ fn, args });
      if (fail === fn) return { data: null, error: { message: "boom" } };
      return { data: fn in returns ? returns[fn] : "tx-id", error: null };
    },
  };
  return { db, calls };
}

const ev = (type: string, object: unknown): StripeEvent => ({ id: "evt_1", type, data: { object } });
const md = { fan_id: "fan-1", creator_id: "cr-1" };

describe("handleStripeEvent", () => {
  it("invoice.paid de alta → record_payment kind=subscription", async () => {
    const { db, calls } = fakeDb();
    const r = await handleStripeEvent(
      ev("invoice.paid", {
        id: "in_1", subscription: "sub_1", amount_paid: 10000, currency: "mxn",
        billing_reason: "subscription_create", charge: "ch_1",
        subscription_details: { metadata: md },
        lines: { data: [{ period: { end: 1_800_000_000 } }] },
      }),
      db
    );
    expect(r.handled).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("record_payment");
    expect(calls[0].args).toMatchObject({
      p_provider: "stripe", p_provider_ref: "in_1", p_provider_ref_alt: "ch_1",
      p_kind: "subscription", p_fan: "fan-1", p_creator: "cr-1", p_gross: 10000, p_currency: "MXN",
      p_provider_subscription_id: "sub_1",
    });
    expect(r.sales[0]).toMatchObject({ kind: "subscription", grossCents: 10000 });
  });

  it("invoice.paid de ciclo → renewal; repetido no genera venta nueva", async () => {
    const { db } = fakeDb({ record_payment: null });
    const r = await handleStripeEvent(
      ev("invoice.paid", {
        id: "in_2", subscription: "sub_1", amount_paid: 10000, billing_reason: "subscription_cycle",
        subscription_details: { metadata: md }, lines: { data: [{ period: { end: 1_800_000_000 } }] },
      }),
      db
    );
    expect(r.handled).toBe(true);
    expect(r.sales).toHaveLength(0);
  });

  it("invoice.paid sin fin de periodo lanza error (Stripe reintenta)", async () => {
    const { db } = fakeDb();
    await expect(
      handleStripeEvent(
        ev("invoice.paid", { id: "in_3", subscription: "s", amount_paid: 1000, subscription_details: { metadata: md }, lines: { data: [{}] } }),
        db
      )
    ).rejects.toThrow();
  });

  it("invoice.paid de $0 o sin metadatos se ignora", async () => {
    const { db, calls } = fakeDb();
    const a = await handleStripeEvent(ev("invoice.paid", { id: "x", subscription: "s", amount_paid: 0 }), db);
    const b = await handleStripeEvent(ev("invoice.paid", { id: "y", subscription: "s", amount_paid: 500 }), db);
    expect(a.handled).toBe(false);
    expect(b.handled).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("checkout de ppv y propina se registran; suscripciones no", async () => {
    const { db, calls } = fakeDb();
    const ppv = await handleStripeEvent(
      ev("checkout.session.completed", {
        id: "cs_1", mode: "payment", payment_status: "paid", payment_intent: "pi_1", amount_total: 5000, currency: "mxn",
        metadata: { ...md, kind: "ppv", post_id: "post-1" },
      }),
      db
    );
    expect(ppv.handled).toBe(true);
    expect(calls[0].args).toMatchObject({ p_kind: "ppv", p_post: "post-1", p_provider_ref: "pi_1", p_gross: 5000 });

    const sub = await handleStripeEvent(ev("checkout.session.completed", { mode: "subscription" }), db);
    expect(sub.handled).toBe(false);
    const unpaid = await handleStripeEvent(
      ev("checkout.session.completed", { mode: "payment", payment_status: "unpaid", metadata: { ...md, kind: "tip" } }),
      db
    );
    expect(unpaid.handled).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("falla de pago → past_due; baja → expired", async () => {
    const { db, calls } = fakeDb();
    await handleStripeEvent(ev("invoice.payment_failed", { subscription: "sub_9" }), db);
    await handleStripeEvent(ev("customer.subscription.deleted", { id: "sub_9" }), db);
    expect(calls[0]).toMatchObject({ fn: "set_subscription_state", args: { p_status: "past_due", p_provider_subscription_id: "sub_9" } });
    expect(calls[1].args).toMatchObject({ p_status: "expired" });
  });

  it("customer.subscription.updated traduce los estados", async () => {
    const { db, calls } = fakeDb();
    await handleStripeEvent(ev("customer.subscription.updated", { id: "s", status: "active", cancel_at_period_end: true, current_period_end: 1_800_000_000 }), db);
    await handleStripeEvent(ev("customer.subscription.updated", { id: "s", status: "active", cancel_at_period_end: false }), db);
    await handleStripeEvent(ev("customer.subscription.updated", { id: "s", status: "unpaid" }), db);
    await handleStripeEvent(ev("customer.subscription.updated", { id: "s", status: "canceled" }), db);
    const r = await handleStripeEvent(ev("customer.subscription.updated", { id: "s", status: "incomplete" }), db);
    expect(calls.map((c) => c.args.p_status)).toEqual(["canceled", "active", "past_due", "expired"]);
    expect(r.handled).toBe(false);
  });

  it("charge.refunded prueba candidatos hasta que uno coincide", async () => {
    let n = 0;
    const calls: string[] = [];
    const db: RpcClient = {
      async rpc(_fn, args = {}) {
        calls.push(String(args.p_ref));
        return { data: ++n === 2, error: null };
      },
    };
    const r = await handleStripeEvent(ev("charge.refunded", { refunded: true, invoice: "in_1", id: "ch_1", payment_intent: "pi_1" }), db);
    expect(calls).toEqual(["in_1", "ch_1"]);
    expect(r.detail).toBe("revocado");
  });

  it("reembolso parcial no revoca; disputa sí", async () => {
    const { db, calls } = fakeDb({ record_refund: true });
    const p = await handleStripeEvent(ev("charge.refunded", { refunded: false, id: "ch_1" }), db);
    expect(p.handled).toBe(false);
    expect(calls).toHaveLength(0);
    const d = await handleStripeEvent(ev("charge.dispute.created", { charge: "ch_1" }), db);
    expect(d.handled).toBe(true);
    expect(calls[0].fn).toBe("record_refund");
  });

  it("errores de base de datos se propagan; eventos desconocidos se ignoran", async () => {
    const { db } = fakeDb({}, "set_subscription_state");
    await expect(handleStripeEvent(ev("invoice.payment_failed", { subscription: "s" }), db)).rejects.toThrow(/boom/);
    const r = await handleStripeEvent(ev("payout.paid", {}), fakeDb().db);
    expect(r.handled).toBe(false);
  });
});
