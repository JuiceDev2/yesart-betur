import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { toForm, verifyStripeSignature } from "./stripe";

describe("toForm", () => {
  it("usa notación de corchetes y omite nulos", () => {
    const p = toForm({
      mode: "payment",
      metadata: { fan_id: "f1", skip: null },
      line_items: [{ quantity: 1, price_data: { currency: "mxn", unit_amount: 5000 } }],
    });
    expect(p.get("mode")).toBe("payment");
    expect(p.get("metadata[fan_id]")).toBe("f1");
    expect(p.has("metadata[skip]")).toBe(false);
    expect(p.get("line_items[0][price_data][unit_amount]")).toBe("5000");
  });
});

describe("verifyStripeSignature", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1"}';
  const now = 1_800_000_000;
  const sign = (t: number, b = body, s = secret) => createHmac("sha256", s).update(`${t}.${b}`).digest("hex");

  it("acepta una firma válida", () => {
    expect(verifyStripeSignature(body, `t=${now},v1=${sign(now)}`, secret, 300, now)).toBe(true);
  });
  it("acepta si alguna de varias firmas coincide", () => {
    expect(verifyStripeSignature(body, `t=${now},v1=deadbeef,v1=${sign(now)}`, secret, 300, now)).toBe(true);
  });
  it("rechaza cuerpo alterado, secreto equivocado y encabezado vacío", () => {
    expect(verifyStripeSignature(body + " ", `t=${now},v1=${sign(now)}`, secret, 300, now)).toBe(false);
    expect(verifyStripeSignature(body, `t=${now},v1=${sign(now, body, "otro")}`, secret, 300, now)).toBe(false);
    expect(verifyStripeSignature(body, null, secret, 300, now)).toBe(false);
    expect(verifyStripeSignature(body, `t=${now}`, secret, 300, now)).toBe(false);
  });
  it("rechaza firmas fuera de la tolerancia (repetición)", () => {
    expect(verifyStripeSignature(body, `t=${now - 301},v1=${sign(now - 301)}`, secret, 300, now)).toBe(false);
    expect(verifyStripeSignature(body, `t=${now + 301},v1=${sign(now + 301)}`, secret, 300, now)).toBe(false);
  });
});
