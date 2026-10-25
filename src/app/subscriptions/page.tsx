import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SubscriptionsList from "@/components/SubscriptionsList";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/data/creators";
import type { SubscriptionRow } from "@/types";

export const metadata: Metadata = { title: "Mis suscripciones", robots: { index: false } };

export default async function SubscriptionsPage() {
  await requireAuth();
  const supabase = await createClient();
  const [{ data }, currency] = await Promise.all([supabase.rpc("my_subscriptions"), getCurrency()]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="font-serif text-3xl font-medium">Mis suscripciones</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Al cancelar conservas el acceso hasta que termine el periodo que ya pagaste.
        </p>
        <SubscriptionsList rows={(data as SubscriptionRow[] | null) ?? []} currency={currency} />
      </main>
      <SiteFooter />
    </div>
  );
}
