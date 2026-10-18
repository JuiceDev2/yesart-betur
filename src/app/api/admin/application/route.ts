import { NextResponse, after } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyArtistApplicationResult } from "@/lib/email";

const schema = z.object({
  appId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { appId, action, reason } = parsed.data;

  // El correo del solicitante se obtiene SIEMPRE de la base de datos,
  // nunca del cuerpo de la petición.
  const service = createAdminClient();
  const { data: application } = await service
    .from("artist_applications")
    .select("user_id, status")
    .eq("id", appId)
    .maybeSingle();

  if (!application) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }

  const { error } =
    action === "approve"
      ? await guard.supabase.rpc("approve_artist_application", { app_id: appId })
      : await guard.supabase.rpc("reject_artist_application", {
          app_id: appId,
          p_reason: reason || null,
        });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: applicant } = await service
    .from("profiles")
    .select("email")
    .eq("id", application.user_id as string)
    .maybeSingle();
  const email = (applicant?.email as string | null) || null;

  if (email) {
    after(async () => {
      try {
        await notifyArtistApplicationResult({
          email,
          approved: action === "approve",
          reason: reason || null,
        });
      } catch (e) {
        console.error("notifyArtistApplicationResult", e);
      }
    });
  }

  return NextResponse.json({ success: true });
}
