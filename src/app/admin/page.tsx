import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { getCurrency } from "@/lib/data/creators";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AdminPanel from "@/components/admin/AdminPanel";

export const metadata: Metadata = { title: "Administración", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAuth(["admin"]);
  const currency = await getCurrency();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <AdminPanel currency={currency} />
      </main>
      <SiteFooter />
    </div>
  );
}
