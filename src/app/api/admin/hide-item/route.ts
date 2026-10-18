import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-guard";

const schema = z.object({
  type: z.enum(["artwork", "service"]),
  id: z.string().uuid(),
  hidden: z.boolean(),
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

  const table = parsed.data.type === "artwork" ? "artworks" : "services";
  const { data, error } = await guard.supabase
    .from(table)
    .update({ is_hidden: parsed.data.hidden })
    .eq("id", parsed.data.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
  }

  const { error: auditError } = await guard.supabase.rpc("write_audit", {
    p_action: parsed.data.hidden ? "hide_item" : "unhide_item",
    p_target_type: parsed.data.type,
    p_target_id: parsed.data.id,
    p_meta: null,
  });
  if (auditError) console.error("write_audit", auditError.message);

  return NextResponse.json({ success: true });
}
