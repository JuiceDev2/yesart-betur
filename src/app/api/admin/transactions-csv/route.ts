import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const BATCH = 1000;
const MAX_ROWS = 50000;

/** Exporta el libro de transacciones completo (para contabilidad). */
export async function GET(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const status = new URL(request.url).searchParams.get("status");
  const rows: unknown[][] = [];

  for (let from = 0; from < MAX_ROWS; from += BATCH) {
    let q = guard.supabase
      .from("transactions")
      .select(
        "id, created_at, kind, status, gross_cents, fee_cents, net_cents, currency, provider, provider_ref, fan_id, creator_id"
      )
      .order("created_at", { ascending: false })
      .range(from, from + BATCH - 1);
    if (status === "completed" || status === "refunded") q = q.eq("status", status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: "No se pudo exportar" }, { status: 500 });
    for (const t of data ?? []) {
      rows.push([
        t.id, t.created_at, t.kind, t.status,
        (Number(t.gross_cents) / 100).toFixed(2), (Number(t.fee_cents) / 100).toFixed(2),
        (Number(t.net_cents) / 100).toFixed(2), t.currency, t.provider, t.provider_ref, t.fan_id, t.creator_id,
      ]);
    }
    if (!data || data.length < BATCH) break;
  }

  const csv = toCsv(
    ["id", "fecha", "tipo", "estado", "bruto", "comision", "neto", "moneda", "proveedor", "referencia", "fan_id", "creador_id"],
    rows
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transacciones-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
