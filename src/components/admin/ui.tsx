"use client";

import { useEffect, useState } from "react";

export const PAGE_SIZE = 15;

/** Devuelve `value` retrasado, para no consultar en cada tecla. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function Pager({
  page,
  total,
  pageSize = PAGE_SIZE,
  onChange,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
    return <p className="mt-4 text-xs text-muted">{total} resultado(s)</p>;
  }
  return (
    <nav
      className="mt-4 flex items-center justify-between text-sm"
      aria-label="Paginación"
    >
      <p className="text-xs text-muted">
        {total} resultados · página {page} de {pages}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="h-8 rounded-lg border border-border px-3 text-xs font-medium disabled:opacity-40"
        >
          ← Anterior
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="h-8 rounded-lg border border-border px-3 text-xs font-medium disabled:opacity-40"
        >
          Siguiente →
        </button>
      </div>
    </nav>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <input
      type="search"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40 sm:max-w-xs"
    />
  );
}

const PILL: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-300",
  yellow: "bg-amber-500/15 text-amber-300",
  blue: "bg-sky-500/15 text-sky-300",
  red: "bg-red-500/15 text-red-300",
  pink: "bg-accent/15 text-accent",
  gray: "bg-white/10 text-neutral-300",
};

export function Pill({
  tone,
  children,
}: {
  tone: keyof typeof PILL;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL[tone]}`}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-12 text-center text-sm text-muted">{children}</p>;
}

export function Loading() {
  return (
    <p className="py-12 text-center text-sm text-muted" role="status">
      Cargando…
    </p>
  );
}
