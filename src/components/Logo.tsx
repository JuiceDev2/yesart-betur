import { cn } from "@/lib/utils";

/** Logotipo de Aura: "ΛURΛ" en dorado, fino y espaciado. Accesible como "Aura". */
export default function Logo({ className, tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <span className={cn("inline-flex flex-col leading-none text-[1.35rem]", className)}>
      <span role="img" aria-label="Aura" className="wordmark">
        <span aria-hidden="true">ΛURΛ</span>
      </span>
      {tagline && (
        <span aria-hidden="true" className="tagline mt-3">
          Explora tu universo
        </span>
      )}
    </span>
  );
}

/** Marca (chevrón + destello) para usos pequeños. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <path d="M10 40 24 8l14 32" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 26.5c.5 3 1.6 4.1 4.6 4.6-3 .5-4.1 1.6-4.6 4.6-.5-3-1.6-4.1-4.6-4.6 3-.5 4.1-1.6 4.6-4.6Z" fill="currentColor" />
    </svg>
  );
}
