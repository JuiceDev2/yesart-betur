import { NextResponse, after } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-guard";
import { notifyPayoutResult } from "@/lib/email";

const schema = z.object({
  payoutId: z.string().uuid(),
  status: z.enum(["paid", "rejected"]),
  reference: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { payoutId, status, reference, note } = parsed.data;

  const { data: payout } = await guard.supabase
    .from("payouts")
    .select("amount_cents, currency")
    .eq("id", payoutId)
    .maybeSingle();

  const { data: creatorId, error } = await guard.supabase.rpc("admin_resolve_payout", {
    p_payout: payoutId,
    p_status: status,
    p_reference: reference ?? null,
    p_note: note ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (creatorId && payout) {
    after(async () => {
      try {
        await notifyPayoutResult({
          creatorId: creatorId as string,
          paid: status === "paid",
          amountCents: payout.amount_cents as number,
          currency: payout.currency as string,
          reference,
          note,
        });
      } catch (e) {
        console.error("notifyPayoutResult", e);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
