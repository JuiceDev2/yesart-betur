import { NextResponse, after } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-guard";
import { notifyApplicationResult } from "@/lib/email";

const schema = z.object({
  appId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { appId, action, note } = parsed.data;

  if (action === "reject" && !note) {
    return NextResponse.json({ error: "Indica el motivo del rechazo" }, { status: 400 });
  }

  const { data: userId, error } = await guard.supabase.rpc("admin_review_application", {
    p_app: appId,
    p_approve: action === "approve",
    p_note: note ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  after(async () => {
    try {
      await notifyApplicationResult({ userId: userId as string, approved: action === "approve", note });
    } catch (e) {
      console.error("notifyApplicationResult", e);
    }
  });
  return NextResponse.json({ ok: true });
}
