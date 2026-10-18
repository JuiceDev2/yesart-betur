import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { toCsv } from "@/lib/csv";
import { orderStatusLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

const PAGE = 1000;
const MAX_ROWS = 50000;

type Row = {
  id: string;
  created_at: string;
  status: string;
  client_name: string;
  client_phone: string;
  notes: string | null;
  artwork_id: string | null;
  service_id: string | null;
  artist: { full_name: string | null } | { full_name: string | null }[] | null;
};

/** Exporta TODAS las órdenes (paginando en bloques), no solo las de la pantalla. */
export async function GET(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const status = new URL(request.url).searchParams.get("status");
  const rows: unknown[][] = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    let q = guard.supabase
      .from("orders")
      .select(
        "id, created_at, status, client_name, client_phone, notes, artwork_id, service_id, artist:profiles!orders_artist_id_fkey(full_name)"
      )
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (status && ["pending", "contacted", "completed", "cancelled"].includes(status)) {
      q = q.eq("status", status);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const batch = (data || []) as unknown as Row[];
    for (const o of batch) {
      const artist = Array.isArray(o.artist) ? o.artist[0] : o.artist;
      rows.push([
        o.id,
        o.created_at,
        orderStatusLabel(o.status),
        o.client_name,
        o.client_phone,
        o.artwork_id ? "Obra" : "Servicio",
        artist?.full_name ?? "",
        o.notes ?? "",
      ]);
    }
    if (batch.length < PAGE) break;
  }

  const csv = toCsv(
    ["ID", "Fecha", "Estado", "Cliente", "Teléfono", "Tipo", "Artista", "Notas"],
    rows
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ordenes-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
