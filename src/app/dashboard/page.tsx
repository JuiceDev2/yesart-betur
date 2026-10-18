import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import { getClientOrders } from "@/lib/data/orders";
import ClientOrders from "@/components/ClientOrders";

export default async function ClientDashboard() {
  const profile = await requireAuth(["client", "admin"]);
  const orders = await getClientOrders(profile.id);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader profile={profile} label="Mi cuenta" />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-medium tracking-tight">
            Hola, {profile.full_name || "cliente"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Tus solicitudes y acceso al catálogo
          </p>
        </div>

        <div className="mb-10 grid gap-6 sm:grid-cols-2 max-w-2xl">
          <Link
            href="/gallery"
            className="card-lift rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent/40"
          >
            <p className="mb-2 text-2xl" aria-hidden>
              🎨
            </p>
            <h2 className="font-medium">Ver catálogo</h2>
            <p className="mt-1 text-sm text-muted">Obras y murales disponibles</p>
          </Link>
          <Link
            href="/become-artist"
            className="card-lift rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent/40"
          >
            <p className="mb-2 text-2xl" aria-hidden>
              ✦
            </p>
            <h2 className="font-medium">Ser artista</h2>
            <p className="mt-1 text-sm text-muted">Solicita publicar tu trabajo</p>
          </Link>
        </div>

        <h2 className="mb-4 font-medium">Mis solicitudes</h2>
        <ClientOrders initialOrders={orders} />

        <p className="mt-16 text-center text-xs text-muted">
          <a href="/account/delete" className="underline hover:text-foreground">
            Eliminar mi cuenta
          </a>
        </p>
      </main>
    </div>
  );
}
