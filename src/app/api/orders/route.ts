import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, after } from "next/server";
import { orderBodySchema, trustedClientIp } from "@/lib/orders-api";
import { notifyNewOrder } from "@/lib/email";

const SAFE_ORDER_ERRORS = [
  "Nombre inválido",
  "Teléfono inválido",
  "Debe indicar exactamente",
  "Demasiadas solicitudes",
  "Obra no disponible",
  "Servicio no disponible",
];

export async function POST(request: Request) {
  try {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const parsed = orderBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    // Honeypot: website max length 0 — if present with content, schema fails;
    // empty website is optional. Extra guard:
    if (parsed.data.website) {
      return NextResponse.json({ success: true, id: null });
    }

    const hasArt = !!parsed.data.artworkId;
    const hasSvc = !!parsed.data.serviceId;
    if (hasArt === hasSvc) {
      return NextResponse.json(
        { error: "Indica exactamente un ítem" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const ip = trustedClientIp(request);
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("create_order", {
      p_client_name: parsed.data.clientName,
      p_client_phone: parsed.data.clientPhone,
      p_artwork_id: parsed.data.artworkId || null,
      p_service_id: parsed.data.serviceId || null,
      p_notes: parsed.data.notes || null,
      p_ip: ip,
      p_user_id: user?.id ?? null,
    });

    if (error) {
      // Solo se muestran al usuario los mensajes de negocio conocidos;
      // cualquier otro error de la base de datos se registra y se oculta.
      const known = SAFE_ORDER_ERRORS.some((m) => error.message.startsWith(m));
      if (!known) console.error("create_order", error.message);
      return NextResponse.json(
        { error: known ? error.message : "No se pudo registrar la solicitud. Intenta de nuevo." },
        { status: known ? 400 : 500 }
      );
    }

    // Correo "best effort": se ejecuta DESPUÉS de responder, pero la plataforma
    // espera a que termine (after) para no congelar la función antes de enviarlo.
    const emailPayload = {
      orderId: data as string,
      clientName: parsed.data.clientName,
      clientPhone: parsed.data.clientPhone,
      artworkId: parsed.data.artworkId,
      serviceId: parsed.data.serviceId,
    };
    after(async () => {
      try {
        await notifyNewOrder(emailPayload);
      } catch (e) {
        console.error("notifyNewOrder", e);
      }
    });

    return NextResponse.json({ success: true, id: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
