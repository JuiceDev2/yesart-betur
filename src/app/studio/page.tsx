import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/data/creators";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StudioPanel from "@/components/studio/StudioPanel";
import type { CreatorSettings } from "@/types";

export const metadata: Metadata = { title: "Estudio", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const profile = await requireAuth(["creator"]);
  const supabase = await createClient();
  const { data } = await supabase.from("creators").select("*").eq("user_id", profile.id).maybeSingle();
  if (!data) redirect("/become-creator");
  const currency = await getCurrency();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <StudioPanel profile={profile} settings={data as CreatorSettings} currency={currency} />
      </main>
      <SiteFooter />
    </div>
  );
}
