import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  userId: z.string().uuid("Usuario inválido"),
});

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 }
    );
  }

  // El correo sale de la base de datos: el panel solo envía el id del usuario,
  // así la plataforma no se puede usar para mandar correos a direcciones ajenas.
  const service = createAdminClient();
  const { data: target } = await service
    .from("profiles")
    .select("email")
    .eq("id", parsed.data.userId)
    .maybeSingle();
  const email = (target?.email as string | null) || null;
  if (!email) {
    return NextResponse.json({ error: "Usuario sin correo" }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { error } = await service.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { error: auditError } = await guard.supabase.rpc("write_audit", {
    p_action: "admin_reset_password",
    p_target_type: "profile",
    p_target_id: parsed.data.userId,
    p_meta: null,
  });
  if (auditError) console.error("write_audit", auditError.message);

  return NextResponse.json({ success: true });
}
