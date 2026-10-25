"use client";

import { useState } from "react";
import AdminStats from "./AdminStats";
import AdminApplications from "./AdminApplications";
import AdminCreators from "./AdminCreators";
import AdminReports from "./AdminReports";
import AdminPayouts from "./AdminPayouts";
import AdminAudit from "./AdminAudit";

const TABS = [
  ["stats", "Resumen"],
  ["apps", "Solicitudes"],
  ["creators", "Creadores"],
  ["reports", "Reportes"],
  ["payouts", "Pagos"],
  ["audit", "Auditoría"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function AdminPanel({ currency }: { currency: string }) {
  const [tab, setTab] = useState<Tab>("stats");
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Administración</h1>
      <div role="tablist" aria-label="Secciones de administración" className="mb-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`atab-${id}`}
            aria-selected={tab === id}
            aria-controls={`apanel-${id}`}
            onClick={() => setTab(id)}
            className={`h-9 shrink-0 rounded-full px-4 text-sm ${tab === id ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`apanel-${tab}`} aria-labelledby={`atab-${tab}`}>
        {tab === "stats" && <AdminStats currency={currency} />}
        {tab === "apps" && <AdminApplications />}
        {tab === "creators" && <AdminCreators currency={currency} />}
        {tab === "reports" && <AdminReports />}
        {tab === "payouts" && <AdminPayouts />}
        {tab === "audit" && <AdminAudit />}
      </div>
    </div>
  );
}
