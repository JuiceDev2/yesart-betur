import Link from "next/link";
import { listArtworks } from "@/lib/data/artworks";
import { listServices } from "@/lib/data/services";
import ArtworkCard from "@/components/ArtworkCard";
import ServiceCard from "@/components/ServiceCard";
import GalleryFilters from "@/components/GalleryFilters";

export const revalidate = 60;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GalleryPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const category = typeof params.category === "string" ? params.category : undefined;
  const sort =
    params.sort === "price_asc" || params.sort === "price_desc"
      ? params.sort
      : "recent";
  const page = Math.max(1, parseInt(String(params.page || "1"), 10) || 1);
  const tab = params.tab === "servicios" ? "servicios" : "obras";

  const [artResult, servResult] = await Promise.all([
    listArtworks({ q, category, sort, page }),
    listServices({ q, sort, page }),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="font-serif text-xl font-semibold">
            Yesart<span className="text-accent">-betur</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-muted hover:text-foreground">
              Cuenta
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
            Catálogo
          </h1>
          <p className="mt-2 text-sm text-muted">
            Obras y servicios de artistas independientes activos
          </p>
        </div>

        <GalleryFilters
          initialQ={q}
          initialCategory={category}
          initialSort={sort}
          initialTab={tab}
        />

        {tab === "obras" ? (
          <section className="mt-10">
            <p className="mb-6 text-sm text-muted">
              {artResult.total} {artResult.total === 1 ? "obra" : "obras"}
            </p>
            {artResult.items.length === 0 ? (
              <Empty message="No hay obras con esos filtros." />
            ) : (
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {artResult.items.map((art) => (
                  <ArtworkCard key={art.id} artwork={art} />
                ))}
              </div>
            )}
            <Pagination
              page={artResult.page}
              total={artResult.total}
              pageSize={artResult.pageSize}
              baseParams={{ q, category, sort, tab: "obras" }}
            />
          </section>
        ) : (
          <section className="mt-10">
            <p className="mb-6 text-sm text-muted">
              {servResult.total} {servResult.total === 1 ? "servicio" : "servicios"}
            </p>
            {servResult.items.length === 0 ? (
              <Empty message="No hay servicios con esos filtros." />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {servResult.items.map((svc) => (
                  <ServiceCard key={svc.id} service={svc} />
                ))}
              </div>
            )}
            <Pagination
              page={servResult.page}
              total={servResult.total}
              pageSize={servResult.pageSize}
              baseParams={{ q, sort, tab: "servicios" }}
            />
          </section>
        )}
      </main>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-16 text-center">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  baseParams,
}: {
  page: number;
  total: number;
  pageSize: number;
  baseParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function href(p: number) {
    const sp = new URLSearchParams();
    Object.entries(baseParams).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    sp.set("page", String(p));
    return `/gallery?${sp.toString()}`;
  }

  return (
    <div className="mt-10 flex items-center justify-center gap-3">
      {page > 1 && (
        <Link href={href(page - 1)} className="text-sm font-medium text-muted hover:text-foreground">
          ← Anterior
        </Link>
      )}
      <span className="text-sm text-muted">
        {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Link href={href(page + 1)} className="text-sm font-medium text-muted hover:text-foreground">
          Siguiente →
        </Link>
      )}
    </div>
  );
}
