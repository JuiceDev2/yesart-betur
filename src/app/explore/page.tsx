import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CreatorCard from "@/components/CreatorCard";
import { CATEGORIES } from "@/lib/constants";
import { EXPLORE_PAGE_SIZE, getCurrency, searchCreators } from "@/lib/data/creators";

export const metadata: Metadata = {
  title: "Explorar creadores",
  description: "Descubre creadores independientes y suscríbete a su contenido exclusivo.",
};

type SP = Promise<{ q?: string; cat?: string; sfw?: string; page?: string }>;

export default async function ExplorePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const cat = CATEGORIES.some((c) => c.value === sp.cat) ? sp.cat : undefined;
  const hideAdult = sp.sfw === "1";
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ rows, total }, currency] = await Promise.all([
    searchCreators({ q, category: cat, hideAdult, page }),
    getCurrency(),
  ]);
  const pages = Math.max(1, Math.ceil(total / EXPLORE_PAGE_SIZE));

  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: q || undefined, cat, sfw: hideAdult ? "1" : undefined, page: undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/explore?${s}` : "/explore";
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="font-serif text-4xl font-medium">Explorar creadores</h1>

        <form action="/explore" method="get" className="mt-6 flex flex-col gap-3 sm:flex-row" role="search">
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Buscar creadores"
            placeholder="Busca por nombre o usuario"
            className="h-11 flex-1 rounded-full border border-border bg-card px-5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          {cat && <input type="hidden" name="cat" value={cat} />}
          {hideAdult && <input type="hidden" name="sfw" value="1" />}
          <button type="submit" className="h-11 rounded-full bg-accent px-7 text-sm font-semibold text-accent-ink">
            Buscar
          </button>
        </form>

        <nav aria-label="Categorías" className="mt-5 flex flex-wrap gap-2">
          <Link
            href={href({ cat: undefined })}
            aria-current={!cat ? "true" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm ${!cat ? "border-accent text-accent" : "border-border text-muted hover:text-foreground"}`}
          >
            Todas
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.value}
              href={href({ cat: c.value })}
              aria-current={cat === c.value ? "true" : undefined}
              className={`rounded-full border px-4 py-1.5 text-sm ${cat === c.value ? "border-accent text-accent" : "border-border text-muted hover:text-foreground"}`}
            >
              {c.label}
            </Link>
          ))}
          <Link
            href={href({ sfw: hideAdult ? undefined : "1" })}
            className="ml-auto rounded-full border border-border px-4 py-1.5 text-sm text-muted hover:text-foreground"
          >
            {hideAdult ? "Mostrar contenido +18" : "Ocultar contenido +18"}
          </Link>
        </nav>

        {rows.length === 0 ? (
          <p className="mt-16 text-center text-sm text-muted">No encontramos creadores con esos filtros.</p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((c) => (
              <CreatorCard key={c.id} c={c} currency={currency} />
            ))}
          </div>
        )}

        {pages > 1 && (
          <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-4 text-sm">
            {page > 1 && (
              <Link href={href({ page: String(page - 1) })} className="rounded-full border border-border px-5 py-2 hover:border-accent">
                ← Anterior
              </Link>
            )}
            <span className="text-muted">
              Página {page} de {pages}
            </span>
            {page < pages && (
              <Link href={href({ page: String(page + 1) })} className="rounded-full border border-border px-5 py-2 hover:border-accent">
                Siguiente →
              </Link>
            )}
          </nav>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
