"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

interface Props {
  initialQ?: string;
  initialCategory?: string;
  initialSort?: string;
  initialTab?: string;
}

export default function GalleryFilters({
  initialQ = "",
  initialCategory = "",
  initialSort = "recent",
  initialTab = "obras",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState(initialSort);
  const [tab, setTab] = useState(initialTab);
  const [pending, startTransition] = useTransition();

  function apply(overrides: Record<string, string> = {}) {
    const sp = new URLSearchParams();
    const next = {
      q,
      category,
      sort,
      tab,
      ...overrides,
    };
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== "recent" && !(k === "tab" && v === "obras")) sp.set(k, v);
      if (k === "sort" && v !== "recent") sp.set(k, v);
      if (k === "tab" && v !== "obras") sp.set(k, v);
    });
    if (overrides.tab === "obras" || (!overrides.tab && tab === "obras")) {
      // default tab omitted
    }
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex gap-2">
        {(["obras", "servicios"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              apply({ tab: t, page: "1" });
            }}
            className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-foreground text-background"
                : "border border-border text-muted hover:text-foreground"
            }`}
          >
            {t === "obras" ? "Obras" : "Servicios"}
          </button>
        ))}
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ page: "1" });
        }}
      >
        <div className="flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted">
            Buscar
          </label>
          <input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Título o descripción..."
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        {tab === "obras" && (
          <div className="w-full sm:w-40">
            <label htmlFor="category" className="mb-1 block text-xs font-medium text-muted">
              Categoría
            </label>
            <input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Pintura..."
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
        )}
        <div className="w-full sm:w-44">
          <label htmlFor="sort" className="mb-1 block text-xs font-medium text-muted">
            Orden
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              apply({ sort: e.target.value, page: "1" });
            }}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="recent">Más recientes</option>
            <option value="price_asc">Precio: menor a mayor</option>
            <option value="price_desc">Precio: mayor a menor</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-full bg-foreground px-5 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "…" : "Filtrar"}
        </button>
      </form>
    </div>
  );
}
