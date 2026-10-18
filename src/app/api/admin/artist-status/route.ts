import { NextResponse, after } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyArtistStatusChange } from "@/lib/email";

const schema = z
  .object({
    artistId: z.string().uuid(),
    active: z.boolean(),
    reason: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => v.active || (v.reason && v.reason.length >= 3), {
    message: "Indica un motivo para deshabilitar",
    path: ["reason"],
  });

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 }
    );
  }
  const { artistId, active, reason } = parsed.data;

  const { error } = await guard.supabase.rpc("admin_set_artist_active", {
    p_artist_id: artistId,
    p_active: active,
    p_reason: reason || null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: artist } = await createAdminClient()
    .from("profiles")
    .select("email")
    .eq("id", artistId)
    .maybeSingle();
  const email = (artist?.email as string | null) || null;
  if (email) {
    after(async () => {
      try {
        await notifyArtistStatusChange({ email, active, reason: reason || null });
      } catch (e) {
        console.error("notifyArtistStatusChange", e);
      }
    });
  }

  return NextResponse.json({ success: true });
}
