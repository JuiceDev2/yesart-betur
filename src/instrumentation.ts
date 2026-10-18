/**
 * Observabilidad mínima sin dependencias externas.
 *
 * Next.js llama a `onRequestError` por cada error no controlado en el servidor
 * (rutas, Server Components, acciones). Se escribe una línea JSON por error;
 * Vercel y cualquier agregador de logs la pueden indexar y alertar sobre ella.
 *
 * Para usar Sentry en su lugar: `npx @sentry/wizard@latest -i nextjs` (instala
 * @sentry/nextjs y genera su propio instrumentation.ts) y borra este archivo.
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind?: string; routePath?: string; routeType?: string }
): Promise<void> {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(
    JSON.stringify({
      level: "error",
      msg: error.message,
      name: error.name,
      stack: error.stack?.split("\n").slice(0, 6).join("\n"),
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      at: new Date().toISOString(),
    })
  );
}
