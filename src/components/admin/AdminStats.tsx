"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "./ui";
import { formatMoney } from "@/lib/money";

interface Stats {
  pending_applications: number;
  open_reports: number;
  priority_reports: number;
  requested_payouts: number;
  requested_payouts_cents: number;
  active_creators: number;
  fans: number;
  gross_30d: number;
  fees_30d: number;
  tx_30d: number;
}

function Stat({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${alert ? "border-red-500/50 bg-red-500/10" : "border-border bg-card"}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function AdminStats({ currency }: { currency: string }) {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await createClient().rpc("admin_stats");
      if (error || !data) setErr(true);
      else setS(data as Stats);
    })();
  }, []);

  if (err) return <p role="alert" className="text-sm text-red-300">No se pudieron cargar las métricas</p>;
  if (!s) return <Loading />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Solicitudes pendientes" value={s.pending_applications} />
      <Stat label="Reportes abiertos" value={s.open_reports} />
      <Stat label="Reportes prioritarios" value={s.priority_reports} alert={s.priority_reports > 0} />
      <Stat label="Retiros por pagar" value={`${s.requested_payouts} · ${formatMoney(s.requested_payouts_cents, currency)}`} />
      <Stat label="Creadores activos" value={s.active_creators} />
      <Stat label="Fans" value={s.fans} />
      <Stat label="Ventas (30 días)" value={formatMoney(s.gross_30d, currency)} />
      <Stat label="Comisión plataforma (30 d)" value={`${formatMoney(s.fees_30d, currency)} · ${s.tx_30d} cobros`} />
    </div>
  );
}
