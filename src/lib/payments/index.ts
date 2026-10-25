import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export function mockPaymentsAllowed(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "1") return false;
  return true;
}

export function getProviderByName(name: string): PaymentProvider {
  if (name === "stripe") return stripeProvider;
  if (name === "mock") {
    if (!mockPaymentsAllowed()) throw new Error("Los pagos de prueba están deshabilitados en producción");
    return mockProvider;
  }
  throw new Error(`Proveedor de pagos desconocido: ${name}`);
}

/** Proveedor para NUEVOS cobros: PAYMENT_PROVIDER, o Stripe si hay clave, o prueba en desarrollo. */
export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER || (process.env.STRIPE_SECRET_KEY ? "stripe" : "mock");
  return getProviderByName(name);
}

export type { PaymentProvider, CheckoutInput } from "./types";
