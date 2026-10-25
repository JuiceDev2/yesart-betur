/**
 * Correo transaccional con Resend (opcional). Sin RESEND_API_KEY solo registra en consola.
 * Estas funciones deben ejecutarse dentro de `after()` (next/server) para que la
 * plataforma no congele la función antes de que el correo salga.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/money";
import { SITE_NAME } from "@/lib/constants";

const FROM_DEFAULT = `${SITE_NAME} <onboarding@resend.dev>`;

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export async function sendEmail(opts: { to: string; subject: string; text: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info("[email] RESEND_API_KEY no configurado, se omite:", opts.subject);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || FROM_DEFAULT,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function emailOf(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
  return (data?.email as string | null) ?? null;
}

export async function notifyApplicationResult(opts: { userId: string; approved: boolean; note?: string | null }) {
  const to = await emailOf(opts.userId);
  if (!to) return;
  await sendEmail({
    to,
    subject: opts.approved ? "Tu solicitud de creador fue aprobada" : "Tu solicitud de creador no fue aprobada",
    text: opts.approved
      ? `¡Bienvenido! Ya puedes publicar y recibir suscripciones. Configura tu precio y tu cuenta de cobro en ${siteUrl()}/studio`
      : [
          "Revisamos tu solicitud y por ahora no pudimos aprobarla.",
          opts.note ? `Motivo: ${opts.note}` : "",
          "Puedes volver a intentarlo con documentos legibles desde tu cuenta.",
        ].filter(Boolean).join("\n"),
  });
}

export async function notifyCreatorSale(opts: {
  creatorId: string;
  kind: "subscription" | "renewal" | "ppv" | "tip";
  grossCents: number;
  currency: string;
}) {
  const to = await emailOf(opts.creatorId);
  if (!to) return;
  const what = { subscription: "una nueva suscripción", renewal: "una renovación", ppv: "una compra de publicación", tip: "una propina" }[opts.kind];
  await sendEmail({
    to,
    subject: `Tienes ${what}`,
    text: `Recibiste ${what} por ${formatMoney(opts.grossCents, opts.currency)} (antes de comisión). Revisa tus ingresos en ${siteUrl()}/studio`,
  });
}

export async function notifyCreatorStatus(opts: { creatorId: string; active: boolean; reason?: string | null }) {
  const to = await emailOf(opts.creatorId);
  if (!to) return;
  await sendEmail({
    to,
    subject: opts.active ? "Tu cuenta de creador fue reactivada" : "Tu cuenta de creador fue suspendida",
    text: opts.active
      ? `Tu cuenta vuelve a estar activa: ${siteUrl()}/studio`
      : [
          "Tu cuenta de creador fue suspendida y tu contenido ya no es visible. Las suscripciones activas se cancelaron.",
          opts.reason ? `Motivo: ${opts.reason}` : "",
          "Si crees que es un error, responde a este correo.",
        ].filter(Boolean).join("\n"),
  });
}

export async function notifyPayoutResult(opts: {
  creatorId: string;
  paid: boolean;
  amountCents: number;
  currency: string;
  reference?: string | null;
  note?: string | null;
}) {
  const to = await emailOf(opts.creatorId);
  if (!to) return;
  await sendEmail({
    to,
    subject: opts.paid ? "Tu retiro fue pagado" : "Tu retiro fue rechazado",
    text: opts.paid
      ? `Pagamos ${formatMoney(opts.amountCents, opts.currency)}.${opts.reference ? ` Referencia: ${opts.reference}.` : ""}`
      : `No pudimos procesar tu retiro de ${formatMoney(opts.amountCents, opts.currency)}. El saldo sigue disponible.${opts.note ? ` Motivo: ${opts.note}` : ""}`,
  });
}
