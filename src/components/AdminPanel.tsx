"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { escapeFilterValue } from "@/lib/filters";
import { auditActionLabel, orderStatusLabel, ORDER_STATUS_ORDER } from "@/lib/labels";
import type { ArtistApplication, Profile } from "@/types";
import {
  Empty,
  first,
  formatDateTime,
  Loading,
  PAGE_SIZE,
  Pager,
  Pill,
  SearchBox,
  useDebounced,
} from "@/components/admin/ui";

interface AdminPanelProps {
  profile: Profile;
}

type Tab = "resumen" | "solicitudes" | "artistas" | "ordenes" | "moderacion" | "auditoria";

interface Metrics {
  appsPending: number;
  artistsActive: number;
  artistsDisabled: number;
  items: number;
  ordersPending: number;
  ordersStale: number;
  ordersTotal: number;
}

interface ApplicationRow extends ArtistApplication {
  applicant?: { full_name: string | null; email: string | null } | null;
}

interface ArtistRow extends Profile {
  obras?: { count: number }[] | null;
}

interface OrderRow {
  id: string;
  client_name: string;
  client_phone: string;
  status: string;
  notes: string | null;
  created_at: string;
  artwork_id: string | null;
  service_id: string | null;
  artist?: { full_name: string | null } | { full_name: string | null }[] | null;
}

interface ModerationRow {
  id: string;
  title: string;
  is_hidden: boolean;
  created_at: string;
}

interface AuditRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: { reason?: string | null } | null;
  created_at: string;
  actor?: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "solicitudes", label: "Solicitudes" },
  { id: "artistas", label: "Artistas" },
  { id: "ordenes", label: "Órdenes" },
  { id: "moderacion", label: "Moderación" },
  { id: "auditoria", label: "Auditoría" },
];

const BTN =
  "h-8 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-accent-soft/50 disabled:opacity-50";

function orderTone(status: string): "yellow" | "blue" | "green" | "gray" {
  if (status === "pending") return "yellow";
  if (status === "contacted") return "blue";
  if (status === "completed") return "green";
  return "gray";
}

function range(page: number): [number, number] {
  const from = (page - 1) * PAGE_SIZE;
  return [from, from + PAGE_SIZE - 1];
}

export default function AdminPanel({ profile }: AdminPanelProps) {
  const supabase = useMemo(() => createClient(), []);

  const [tab, setTab] = useState<Tab>("resumen");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  // ---- Solicitudes ----
  const [appsFilter, setAppsFilter] = useState<"pending" | "all">("pending");
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [appsTotal, setAppsTotal] = useState(0);
  const [appsPage, setAppsPage] = useState(1);
  const [appsLoading, setAppsLoading] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // ---- Artistas ----
  const [artistQuery, setArtistQuery] = useState("");
  const [artistStatus, setArtistStatus] = useState<"all" | "active" | "disabled">("all");
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [artistsTotal, setArtistsTotal] = useState(0);
  const [artistsPage, setArtistsPage] = useState(1);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [disabling, setDisabling] = useState<string | null>(null);
  const [disableReason, setDisableReason] = useState("");

  // ---- Órdenes ----
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState<string>("all");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // ---- Moderación ----
  const [modKind, setModKind] = useState<"artworks" | "services">("artworks");
  const [modQuery, setModQuery] = useState("");
  const [modItems, setModItems] = useState<ModerationRow[]>([]);
  const [modTotal, setModTotal] = useState(0);
  const [modPage, setModPage] = useState(1);
  const [modLoading, setModLoading] = useState(false);

  // ---- Auditoría ----
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);

  const dArtistQuery = useDebounced(artistQuery);
  const dOrderQuery = useDebounced(orderQuery);
  const dModQuery = useDebounced(modQuery);

  // ------------------------------------------------------------------ métricas
  const loadMetrics = useCallback(async () => {
    const staleBefore = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const head = { count: "exact" as const, head: true };
    const [appsP, artA, artD, arts, svcs, ordP, ordS, ordT] = await Promise.all([
      supabase.from("artist_applications").select("id", head).eq("status", "pending"),
      supabase.from("profiles").select("id", head).eq("role", "artist").eq("is_active", true),
      supabase.from("profiles").select("id", head).eq("role", "artist").eq("is_active", false),
      supabase.from("artworks").select("id", head).eq("is_hidden", false),
      supabase.from("services").select("id", head).eq("is_hidden", false),
      supabase.from("orders").select("id", head).eq("status", "pending"),
      supabase
        .from("orders")
        .select("id", head)
        .eq("status", "pending")
        .lt("created_at", staleBefore),
      supabase.from("orders").select("id", head),
    ]);
    setMetrics({
      appsPending: appsP.count ?? 0,
      artistsActive: artA.count ?? 0,
      artistsDisabled: artD.count ?? 0,
      items: (arts.count ?? 0) + (svcs.count ?? 0),
      ordersPending: ordP.count ?? 0,
      ordersStale: ordS.count ?? 0,
      ordersTotal: ordT.count ?? 0,
    });
  }, [supabase]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  // --------------------------------------------------------------- solicitudes
  const loadApps = useCallback(async () => {
    setAppsLoading(true);
    const [from, to] = range(appsPage);
    let q = supabase
      .from("artist_applications")
      .select(
        "*, applicant:profiles!artist_applications_user_id_fkey(full_name, email)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    if (appsFilter === "pending") q = q.eq("status", "pending");
    const { data, count, error } = await q;
    if (error) setMessage({ type: "err", text: error.message });
    setApps((data || []) as ApplicationRow[]);
    setAppsTotal(count ?? 0);
    setAppsLoading(false);
  }, [supabase, appsPage, appsFilter]);

  // ------------------------------------------------------------------ artistas
  const loadArtists = useCallback(async () => {
    setArtistsLoading(true);
    const [from, to] = range(artistsPage);
    let q = supabase
      .from("profiles")
      .select("*, obras:artworks(count)", { count: "exact" })
      .eq("role", "artist")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (artistStatus === "active") q = q.eq("is_active", true);
    if (artistStatus === "disabled") q = q.eq("is_active", false);
    const term = escapeFilterValue(dArtistQuery);
    if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
    const { data, count, error } = await q;
    if (error) setMessage({ type: "err", text: error.message });
    setArtists((data || []) as ArtistRow[]);
    setArtistsTotal(count ?? 0);
    setArtistsLoading(false);
  }, [supabase, artistsPage, artistStatus, dArtistQuery]);

  // ------------------------------------------------------------------- órdenes
  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    const [from, to] = range(ordersPage);
    let q = supabase
      .from("orders")
      .select(
        "id, client_name, client_phone, status, notes, created_at, artwork_id, service_id, artist:profiles!orders_artist_id_fkey(full_name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    if (orderStatus !== "all") q = q.eq("status", orderStatus);
    const term = escapeFilterValue(dOrderQuery);
    if (term) q = q.or(`client_name.ilike.%${term}%,client_phone.ilike.%${term}%`);
    const { data, count, error } = await q;
    if (error) setMessage({ type: "err", text: error.message });
    setOrders((data || []) as unknown as OrderRow[]);
    setOrdersTotal(count ?? 0);
    setOrdersLoading(false);
  }, [supabase, ordersPage, orderStatus, dOrderQuery]);

  // ---------------------------------------------------------------- moderación
  const loadModeration = useCallback(async () => {
    setModLoading(true);
    const [from, to] = range(modPage);
    let q = supabase
      .from(modKind)
      .select("id, title, is_hidden, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    const term = escapeFilterValue(dModQuery);
    if (term) q = q.ilike("title", `%${term}%`);
    const { data, count, error } = await q;
    if (error) setMessage({ type: "err", text: error.message });
    setModItems((data || []) as ModerationRow[]);
    setModTotal(count ?? 0);
    setModLoading(false);
  }, [supabase, modKind, modPage, dModQuery]);

  // ----------------------------------------------------------------- auditoría
  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    const [from, to] = range(auditPage);
    const { data, count, error } = await supabase
      .from("audit_log")
      .select(
        "id, action, target_type, target_id, meta, created_at, actor:profiles!audit_log_actor_id_fkey(full_name, email)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) setMessage({ type: "err", text: error.message });
    setAudit((data || []) as unknown as AuditRow[]);
    setAuditTotal(count ?? 0);
    setAuditLoading(false);
  }, [supabase, auditPage]);

  // Carga la pestaña activa (y el resumen necesita un poco de auditoría)
  useEffect(() => {
    if (tab === "solicitudes") void loadApps();
  }, [tab, loadApps]);
  useEffect(() => {
    if (tab === "artistas") void loadArtists();
  }, [tab, loadArtists]);
  useEffect(() => {
    if (tab === "ordenes") void loadOrders();
  }, [tab, loadOrders]);
  useEffect(() => {
    if (tab === "moderacion") void loadModeration();
  }, [tab, loadModeration]);
  useEffect(() => {
    if (tab === "auditoria" || tab === "resumen") void loadAudit();
  }, [tab, loadAudit]);

  // Al cambiar un filtro se vuelve a la página 1
  useEffect(() => setAppsPage(1), [appsFilter]);
  useEffect(() => setArtistsPage(1), [artistStatus, dArtistQuery]);
  useEffect(() => setOrdersPage(1), [orderStatus, dOrderQuery]);
  useEffect(() => setModPage(1), [modKind, dModQuery]);

  // ------------------------------------------------------------------ acciones
  async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return res.ok ? { ok: true } : { ok: false, error: data.error || "Error" };
    } catch {
      return { ok: false, error: "Error de red" };
    }
  }

  async function reviewApplication(
    appId: string,
    action: "approve" | "reject",
    reason?: string
  ) {
    setBusyId(appId);
    setMessage(null);
    const r = await post("/api/admin/application", { appId, action, reason: reason || null });
    if (!r.ok) {
      setMessage({ type: "err", text: r.error || "Error" });
    } else {
      setMessage({
        type: "ok",
        text: action === "approve" ? "Solicitud aprobada" : "Solicitud rechazada",
      });
      setRejecting(null);
      setRejectReason("");
      await Promise.all([loadApps(), loadMetrics()]);
    }
    setBusyId(null);
  }

  async function setArtistActive(artist: ArtistRow, active: boolean, reason?: string) {
    setBusyId(artist.id);
    setMessage(null);
    const r = await post("/api/admin/artist-status", {
      artistId: artist.id,
      active,
      reason: reason || null,
    });
    if (!r.ok) {
      setMessage({ type: "err", text: r.error || "Error" });
    } else {
      setMessage({
        type: "ok",
        text: `${artist.full_name || artist.email} ${active ? "habilitado" : "deshabilitado"}`,
      });
      setDisabling(null);
      setDisableReason("");
      await Promise.all([loadArtists(), loadMetrics()]);
    }
    setBusyId(null);
  }

  async function resetPassword(artist: ArtistRow) {
    if (!confirm(`¿Enviar correo de restablecimiento de contraseña a ${artist.email}?`)) return;
    setBusyId(artist.id);
    setMessage(null);
    const r = await post("/api/admin/reset-password", { userId: artist.id });
    setMessage(
      r.ok
        ? { type: "ok", text: `Correo de restablecimiento enviado a ${artist.email}` }
        : { type: "err", text: r.error || "Error" }
    );
    setBusyId(null);
  }

  async function toggleHidden(item: ModerationRow) {
    setBusyId(item.id);
    setMessage(null);
    const r = await post("/api/admin/hide-item", {
      type: modKind === "artworks" ? "artwork" : "service",
      id: item.id,
      hidden: !item.is_hidden,
    });
    if (!r.ok) {
      setMessage({ type: "err", text: r.error || "Error" });
    } else {
      setMessage({
        type: "ok",
        text: item.is_hidden ? "Ítem visible de nuevo" : "Ítem ocultado",
      });
      await Promise.all([loadModeration(), loadMetrics()]);
    }
    setBusyId(null);
  }

  function goTo(next: Tab, opts?: { orderStatus?: string }) {
    if (opts?.orderStatus) setOrderStatus(opts.orderStatus);
    setTab(next);
  }

  // -------------------------------------------------------------------- render
  const attention = metrics
    ? [
        {
          show: metrics.appsPending > 0,
          text: `${metrics.appsPending} solicitud(es) de artista sin revisar`,
          action: () => goTo("solicitudes"),
          label: "Revisar",
        },
        {
          show: metrics.ordersStale > 0,
          text: `${metrics.ordersStale} orden(es) pendientes desde hace más de 48 horas`,
          action: () => goTo("ordenes", { orderStatus: "pending" }),
          label: "Ver órdenes",
        },
      ].filter((a) => a.show)
    : [];

  const cards = metrics
    ? [
        { label: "Solicitudes por revisar", value: metrics.appsPending, go: () => goTo("solicitudes") },
        {
          label: "Órdenes pendientes",
          value: metrics.ordersPending,
          go: () => goTo("ordenes", { orderStatus: "pending" }),
        },
        { label: "Artistas activos", value: metrics.artistsActive, go: () => goTo("artistas") },
        { label: "Obras y servicios publicados", value: metrics.items, go: () => goTo("moderacion") },
      ]
    : [];

  return (
    <div>
      {message && (
        <div
          role="status"
          className={`mb-6 rounded-xl px-4 py-3 text-sm ${
            message.type === "ok"
              ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
              : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
          }`}
        >
          {message.text}
          <button type="button" onClick={() => setMessage(null)} className="ml-3 text-xs underline">
            cerrar
          </button>
        </div>
      )}

      <div role="tablist" aria-label="Secciones de administración" className="mb-8 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {t.id === "solicitudes" && metrics && metrics.appsPending > 0 && (
              <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                {metrics.appsPending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ============================ RESUMEN ============================ */}
      {tab === "resumen" && (
        <div className="space-y-10">
          <p className="text-sm text-muted">
            Hola, <strong className="text-foreground">{profile.full_name || profile.email}</strong>.
          </p>

          {!metrics ? (
            <Loading />
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {cards.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={c.go}
                  className="rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-accent/50"
                >
                  <p className="text-xs text-muted">{c.label}</p>
                  <p className="mt-1 font-serif text-3xl text-accent">{c.value}</p>
                </button>
              ))}
            </div>
          )}

          <section aria-labelledby="pendiente-h">
            <h2 id="pendiente-h" className="mb-3 font-medium">
              Pendiente de atender
            </h2>
            {metrics && attention.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
                Todo al día. No hay solicitudes ni órdenes atrasadas.
              </p>
            ) : (
              <ul className="space-y-2">
                {attention.map((a) => (
                  <li
                    key={a.text}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 text-sm"
                  >
                    <span>{a.text}</span>
                    <button type="button" onClick={a.action} className={BTN}>
                      {a.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="mov-h">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="mov-h" className="font-medium">
                Últimos movimientos
              </h2>
              <button type="button" onClick={() => setTab("auditoria")} className="text-xs text-accent underline">
                Ver todo el registro
              </button>
            </div>
            {auditLoading ? (
              <Loading />
            ) : audit.length === 0 ? (
              <Empty>Aún no hay movimientos registrados.</Empty>
            ) : (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {audit.slice(0, 5).map((a) => (
                  <AuditItem key={a.id} row={a} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* =========================== SOLICITUDES ========================== */}
      {tab === "solicitudes" && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm text-muted" htmlFor="apps-filter">
              Mostrar
            </label>
            <select
              id="apps-filter"
              value={appsFilter}
              onChange={(e) => setAppsFilter(e.target.value as "pending" | "all")}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
            >
              <option value="pending">Solo pendientes</option>
              <option value="all">Todas</option>
            </select>
          </div>

          {appsLoading ? (
            <Loading />
          ) : apps.length === 0 ? (
            <Empty>No hay solicitudes {appsFilter === "pending" ? "pendientes" : ""}.</Empty>
          ) : (
            <ul className="space-y-3">
              {apps.map((app) => (
                <li key={app.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {app.applicant?.full_name || app.applicant?.email || "Usuario"}
                      </p>
                      <p className="text-xs text-muted">{app.applicant?.email}</p>
                      {app.portfolio_url && (
                        <a
                          href={app.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="mt-1 inline-block text-xs text-accent underline"
                        >
                          Ver portafolio
                        </a>
                      )}
                      {app.message && (
                        <p className="mt-2 text-sm text-muted">&ldquo;{app.message}&rdquo;</p>
                      )}
                      <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                        <Pill tone={app.status === "pending" ? "yellow" : app.status === "approved" ? "green" : "gray"}>
                          {app.status === "pending" ? "Pendiente" : app.status === "approved" ? "Aprobada" : "Rechazada"}
                        </Pill>
                        {formatDateTime(app.created_at)}
                      </p>
                      {app.review_note && (
                        <p className="mt-1 text-xs text-muted">Motivo: {app.review_note}</p>
                      )}
                    </div>

                    {app.status === "pending" && rejecting !== app.id && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          disabled={busyId === app.id}
                          onClick={() => {
                            if (confirm("¿Aprobar esta solicitud? La persona pasará a ser artista.")) {
                              void reviewApplication(app.id, "approve");
                            }
                          }}
                          className="h-8 rounded-lg bg-green-600 px-3 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={busyId === app.id}
                          onClick={() => {
                            setRejecting(app.id);
                            setRejectReason("");
                          }}
                          className="h-8 rounded-lg border border-red-300 px-3 text-xs font-medium text-red-700 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>

                  {rejecting === app.id && (
                    <form
                      className="mt-4 space-y-2 border-t border-border pt-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void reviewApplication(app.id, "reject", rejectReason);
                      }}
                    >
                      <label className="block text-xs font-medium" htmlFor={`reject-${app.id}`}>
                        Motivo del rechazo (se envía a la persona)
                      </label>
                      <textarea
                        id={`reject-${app.id}`}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        maxLength={500}
                        rows={2}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busyId === app.id}
                          className="h-8 rounded-lg bg-red-600 px-3 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Confirmar rechazo
                        </button>
                        <button type="button" onClick={() => setRejecting(null)} className={BTN}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Pager page={appsPage} total={appsTotal} onChange={setAppsPage} />
        </div>
      )}

      {/* ============================ ARTISTAS ============================ */}
      {tab === "artistas" && (
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <SearchBox
              value={artistQuery}
              onChange={setArtistQuery}
              placeholder="Buscar por nombre o correo…"
              label="Buscar artista"
            />
            <select
              aria-label="Filtrar por estado"
              value={artistStatus}
              onChange={(e) => setArtistStatus(e.target.value as "all" | "active" | "disabled")}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="disabled">Deshabilitados</option>
            </select>
          </div>

          {artistsLoading ? (
            <Loading />
          ) : artists.length === 0 ? (
            <Empty>No se encontraron artistas.</Empty>
          ) : (
            <ul className="space-y-3">
              {artists.map((artist) => (
                <li key={artist.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium">{artist.full_name || "—"}</p>
                      <p className="text-xs text-muted">{artist.email}</p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                        <Pill tone={artist.is_active ? "green" : "yellow"}>
                          {artist.is_active ? "Activo" : "Deshabilitado"}
                        </Pill>
                        {artist.obras?.[0]?.count ?? 0} obra(s) · alta {new Date(artist.created_at).toLocaleDateString("es-MX")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {artist.is_active ? (
                        <button
                          type="button"
                          disabled={busyId === artist.id}
                          onClick={() => {
                            setDisabling(artist.id);
                            setDisableReason("");
                          }}
                          className={BTN}
                        >
                          Deshabilitar
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === artist.id}
                          onClick={() => void setArtistActive(artist, true)}
                          className={BTN}
                        >
                          Habilitar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === artist.id}
                        onClick={() => void resetPassword(artist)}
                        className={BTN}
                      >
                        Restablecer contraseña
                      </button>
                    </div>
                  </div>

                  {disabling === artist.id && (
                    <form
                      className="mt-4 space-y-2 border-t border-border pt-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void setArtistActive(artist, false, disableReason);
                      }}
                    >
                      <label className="block text-xs font-medium" htmlFor={`dis-${artist.id}`}>
                        Motivo (obligatorio; se registra y se envía al artista)
                      </label>
                      <textarea
                        id={`dis-${artist.id}`}
                        value={disableReason}
                        onChange={(e) => setDisableReason(e.target.value)}
                        required
                        minLength={3}
                        maxLength={500}
                        rows={2}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busyId === artist.id}
                          className="h-8 rounded-lg bg-red-600 px-3 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                        <button type="button" onClick={() => setDisabling(null)} className={BTN}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Pager page={artistsPage} total={artistsTotal} onChange={setArtistsPage} />
        </div>
      )}

      {/* ============================= ÓRDENES ============================ */}
      {tab === "ordenes" && (
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchBox
              value={orderQuery}
              onChange={setOrderQuery}
              placeholder="Buscar por cliente o teléfono…"
              label="Buscar orden"
            />
            <select
              aria-label="Filtrar por estado"
              value={orderStatus}
              onChange={(e) => setOrderStatus(e.target.value)}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
            >
              <option value="all">Todos los estados</option>
              {ORDER_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {orderStatusLabel(s)}
                </option>
              ))}
            </select>
            <a
              href={`/api/admin/orders-csv${orderStatus !== "all" ? `?status=${orderStatus}` : ""}`}
              className={`${BTN} inline-flex items-center sm:ml-auto`}
            >
              Exportar CSV (todas)
            </a>
          </div>

          {ordersLoading ? (
            <Loading />
          ) : orders.length === 0 ? (
            <Empty>No hay órdenes con esos filtros.</Empty>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => {
                const artist = first(o.artist);
                return (
                  <li key={o.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{o.client_name}</p>
                      <span className="text-xs text-muted">· {o.client_phone}</span>
                      <Pill tone={orderTone(o.status)}>{orderStatusLabel(o.status)}</Pill>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {o.artwork_id ? "Obra" : "Servicio"} · Artista: {artist?.full_name || "—"} ·{" "}
                      {formatDateTime(o.created_at)}
                    </p>
                    {o.notes && <p className="mt-2 text-sm text-muted">&ldquo;{o.notes}&rdquo;</p>}
                  </li>
                );
              })}
            </ul>
          )}
          <Pager page={ordersPage} total={ordersTotal} onChange={setOrdersPage} />
        </div>
      )}

      {/* =========================== MODERACIÓN =========================== */}
      {tab === "moderacion" && (
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <SearchBox
              value={modQuery}
              onChange={setModQuery}
              placeholder="Buscar por título…"
              label="Buscar ítem"
            />
            <select
              aria-label="Tipo de ítem"
              value={modKind}
              onChange={(e) => setModKind(e.target.value as "artworks" | "services")}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
            >
              <option value="artworks">Obras</option>
              <option value="services">Servicios</option>
            </select>
          </div>

          {modLoading ? (
            <Loading />
          ) : modItems.length === 0 ? (
            <Empty>No hay ítems.</Empty>
          ) : (
            <ul className="space-y-3">
              {modItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <Pill tone={item.is_hidden ? "red" : "green"}>
                        {item.is_hidden ? "Oculto" : "Visible"}
                      </Pill>
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void toggleHidden(item)}
                    className={BTN}
                  >
                    {item.is_hidden ? "Mostrar" : "Ocultar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Pager page={modPage} total={modTotal} onChange={setModPage} />
        </div>
      )}

      {/* ============================ AUDITORÍA =========================== */}
      {tab === "auditoria" && (
        <div>
          {auditLoading ? (
            <Loading />
          ) : audit.length === 0 ? (
            <Empty>Aún no hay movimientos registrados.</Empty>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {audit.map((a) => (
                <AuditItem key={a.id} row={a} />
              ))}
            </ul>
          )}
          <Pager page={auditPage} total={auditTotal} onChange={setAuditPage} />
        </div>
      )}
    </div>
  );
}

function AuditItem({ row }: { row: AuditRow }) {
  const actor = first(row.actor);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{auditActionLabel(row.action)}</p>
        <p className="text-xs text-muted">
          {actor?.full_name || actor?.email || "Sistema"}
          {row.target_type ? ` · ${row.target_type} ${row.target_id?.slice(0, 8) ?? ""}` : ""}
          {row.meta?.reason ? ` · Motivo: ${row.meta.reason}` : ""}
        </p>
      </div>
      <time className="text-xs text-muted" dateTime={row.created_at}>
        {formatDateTime(row.created_at)}
      </time>
    </li>
  );
}
