/**
 * Correo transaccional con Resend (opcional).
 * Si RESEND_API_KEY no está definido, solo registra en consola y no hace nada.
 *
 * IMPORTANTE: estas funciones deben ejecutarse dentro de `after()` (next/server)
 * para que la plataforma no congele la función antes de que el correo salga.
 */

type NewOrderPayload = {
  orderId: string;
  clientName: string;
  clientPhone: string;
  artworkId?: string | null;
  serviceId?: string | null;
};

const FROM_DEFAULT = "Galería Viva <onboarding@resend.dev>";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info("[email] RESEND_API_KEY no configurado, se omite:", opts.subject);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
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

/** Avisa al artista dueño del ítem (y opcionalmente a OPS_EMAIL) de una orden nueva. */
export async function notifyNewOrder(payload: NewOrderPayload): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.info("[email] sin RESEND_API_KEY, se omite notifyNewOrder", payload.orderId);
    return;
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  let artistId: string | null = null;
  let itemTitle = "Solicitud";

  if (payload.artworkId) {
    const { data } = await admin
      .from("artworks")
      .select("title, artist_id")
      .eq("id", payload.artworkId)
      .maybeSingle();
    if (data) {
      itemTitle = data.title as string;
      artistId = data.artist_id as string;
    }
  } else if (payload.serviceId) {
    const { data } = await admin
      .from("services")
      .select("title, artist_id")
      .eq("id", payload.serviceId)
      .maybeSingle();
    if (data) {
      itemTitle = data.title as string;
      artistId = data.artist_id as string;
    }
  }

  let artistEmail: string | null = null;
  if (artistId) {
    const { data: prof } = await admin
      .from("profiles")
      .select("email")
      .eq("id", artistId)
      .maybeSingle();
    artistEmail = (prof?.email as string | null) || null;
  }

  const tasks: Promise<void>[] = [];

  if (artistEmail) {
    tasks.push(
      sendEmail({
        to: artistEmail,
        subject: `Nueva solicitud: ${itemTitle}`,
        text: [
          "Hola,",
          "",
          "Tienes una nueva solicitud en Galería Viva.",
          `Ítem: ${itemTitle}`,
          `Cliente: ${payload.clientName}`,
          `Teléfono: ${payload.clientPhone}`,
          "",
          `Revisa tu panel: ${siteUrl()}/artist`,
        ].join("\n"),
      })
    );
  }

  const ops = process.env.OPS_EMAIL;
  if (ops) {
    tasks.push(
      sendEmail({
        to: ops,
        subject: `Orden ${payload.orderId.slice(0, 8)}`,
        text: `Nueva orden ${payload.orderId} — ${itemTitle} — ${payload.clientName}`,
      })
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === "rejected") console.error("[email] notifyNewOrder", r.reason);
  }
}

/** Avisa al solicitante el resultado de su solicitud de artista. */
export async function notifyArtistApplicationResult(opts: {
  email: string;
  approved: boolean;
  reason?: string | null;
}): Promise<void> {
  const site = siteUrl();
  await sendEmail({
    to: opts.email,
    subject: opts.approved
      ? "Tu solicitud de artista fue aprobada"
      : "Tu solicitud de artista no fue aprobada",
    text: opts.approved
      ? `¡Felicidades! Ya puedes publicar obras y servicios en ${site}/artist`
      : [
          "Tu solicitud de artista no fue aprobada por ahora.",
          opts.reason ? `Motivo: ${opts.reason}` : "",
          "Puedes volver a intentarlo más adelante desde tu cuenta.",
        ]
          .filter(Boolean)
          .join("\n"),
  });
}

/** Avisa a un artista que su cuenta fue habilitada o deshabilitada. */
export async function notifyArtistStatusChange(opts: {
  email: string;
  active: boolean;
  reason?: string | null;
}): Promise<void> {
  await sendEmail({
    to: opts.email,
    subject: opts.active
      ? "Tu cuenta de artista fue habilitada"
      : "Tu cuenta de artista fue deshabilitada",
    text: opts.active
      ? `Tu cuenta de artista vuelve a estar activa: ${siteUrl()}/artist`
      : [
          "Tu cuenta de artista fue deshabilitada y tus obras ya no son públicas.",
          opts.reason ? `Motivo: ${opts.reason}` : "",
          "Si crees que es un error, responde a este correo.",
        ]
          .filter(Boolean)
          .join("\n"),
  });
}
