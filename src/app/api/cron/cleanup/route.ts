import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/cleanup
 *
 * Autorización ÚNICA: `Authorization: Bearer $CRON_SECRET`.
 * Vercel Cron envía ese encabezado automáticamente cuando la variable CRON_SECRET existe.
 * No se acepta ningún otro encabezado (p. ej. `x-vercel-cron`): cualquiera puede falsificarlo.
 */
function bearerMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

type Admin = ReturnType<typeof createAdminClient>;

async function step(results: Record<string, string>, name: string, fn: () => Promise<string | void>) {
  try {
    results[name] = (await fn()) || "ok";
  } catch (e) {
    results[name] = `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function rpcOrThrow(admin: Admin, fn: string, args?: Record<string, unknown>) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "CRON_SECRET no configurado (mínimo 16 caracteres)" }, { status: 500 });
  }
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results: Record<string, string> = {};

  await step(results, "rate_events", async () => void (await rpcOrThrow(admin, "cleanup_rate_events")));
  await step(results, "audit", async () => void (await rpcOrThrow(admin, "cleanup_old_audit", { p_days: 365 })));
  await step(results, "subscriptions", async () => {
    const n = await rpcOrThrow(admin, "expire_subscriptions");
    return `ok (${n ?? 0} vencidas)`;
  });

  // Subidas abandonadas (se subió el archivo pero no se llegó a publicar)
  await step(results, "orphan_media", async () => {
    const paths = ((await rpcOrThrow(admin, "orphan_media_paths", { p_hours: 24 })) as string[] | null) ?? [];
    if (paths.length > 0) {
      const { error } = await admin.storage.from("media").remove(paths);
      if (error) throw new Error(error.message);
    }
    return `ok (${paths.length} eliminados)`;
  });

  // Documentos de verificación: se borran 30 días después de resolver la solicitud
  await step(results, "kyc", async () => {
    const rows =
      ((await rpcOrThrow(admin, "kyc_to_purge", { p_days: 30 })) as Array<{ app_id: string; paths: string[] }> | null) ?? [];
    const done: string[] = [];
    for (const r of rows) {
      const { error } = await admin.storage.from("kyc").remove(r.paths);
      if (!error) done.push(r.app_id);
    }
    if (done.length > 0) await rpcOrThrow(admin, "mark_kyc_purged", { p_app_ids: done });
    return `ok (${done.length} solicitudes)`;
  });

  const failed = Object.values(results).some((r) => r.startsWith("error"));
  return NextResponse.json(
    { ok: !failed, results, at: new Date().toISOString() },
    { status: failed ? 500 : 200 }
  );
}
