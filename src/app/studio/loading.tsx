export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-8" aria-busy="true">
      <div className="h-8 w-48 rounded-lg bg-border" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-border/60" />
        ))}
      </div>
    </div>
  );
}
