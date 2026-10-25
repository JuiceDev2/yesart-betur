export type CheckoutKind = "subscription" | "ppv" | "tip";

export interface CheckoutInput {
  kind: CheckoutKind;
  fanId: string;
  fanEmail: string | null;
  creatorId: string;
  creatorUsername: string;
  amountCents: number;
  currency: string;
  postId?: string | null;
  message?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentProvider {
  name: "stripe" | "mock";
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  /** immediately=false → deja de renovarse pero conserva acceso hasta fin del periodo. */
  cancelSubscription(providerSubscriptionId: string, opts: { immediately: boolean }): Promise<void>;
}

/** Subconjunto del cliente de Supabase que usan los webhooks (facilita las pruebas). */
export interface RpcClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
