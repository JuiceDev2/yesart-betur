import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/cleanup
 *
 * Autorización ÚNICA: `Authorization: Bearer $CRON_SECRET`.
 * Vercel Cron envía ese encabezado automáticamente cuando la variable
 * CRON_SECRET existe en el proyecto. No se acepta ningún otro encabezado
 * (por ejemplo `x-vercel-cron`) porque cualquiera puede falsificarlo.
 */
function bearerMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado (mínimo 16 caracteres)" },
      { status: 500 }
    );
  }

  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results: Record<string, string> = {};

  const rateLimits = await admin.rpc("cleanup_rate_limits");
  results.rate_limits = rateLimits.error ? `error: ${rateLimits.error.message}` : "ok";

  const audit = await admin.rpc("cleanup_old_audit", { p_days: 180 });
  results.audit = audit.error ? `error: ${audit.error.message}` : "ok";

  const failed = Object.values(results).some((r) => r.startsWith("error"));
  return NextResponse.json(
    { ok: !failed, results, at: new Date().toISOString() },
    { status: failed ? 500 : 200 }
  );
}
