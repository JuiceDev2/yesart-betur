import { requireAuth } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import AdminPanel from "@/components/AdminPanel";

export default async function AdminPage() {
  const profile = await requireAuth(["admin"]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader profile={profile} label="Administración" />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-medium tracking-tight">
            Panel de administración
          </h1>
          <p className="mt-1 text-sm text-muted">
            Métricas, gestión de artistas y órdenes
          </p>
        </div>
        <AdminPanel profile={profile} />
      </main>
    </div>
  );
}
