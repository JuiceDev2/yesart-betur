import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { getCurrency } from "@/lib/data/creators";
import AdminPanel from "@/components/admin/AdminPanel";

export const metadata: Metadata = { title: "Administración", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAuth(["admin"]);
  const currency = await getCurrency();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <AdminPanel currency={currency} />
    </main>
  );
}
