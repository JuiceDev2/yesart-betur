export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-6 py-16">
      <div className="h-8 w-48 rounded-lg bg-border" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="aspect-[4/5] rounded-2xl bg-border/60" />
        ))}
      </div>
    </div>
  );
}
