export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div
        className="h-8 w-8 animate-pulse rounded-full bg-accent/40"
        aria-label="Cargando"
      />
    </div>
  );
}
