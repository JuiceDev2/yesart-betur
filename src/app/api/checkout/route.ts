import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutSchema } from "@/lib/validation";
import { getPaymentProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * POST /api/checkout — inicia un cobro (suscripción, publicación de pago o propina).
 * Los precios SIEMPRE se leen de la base de datos; el cliente solo dice qué quiere comprar
 * (y el importe, únicamente en las propinas).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar" }, { status: 401 });

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const body = parsed.data;

  const admin = createAdminClient();

  const { data: me } = await admin
    .from("profiles")
    .select("is_active, age_confirmed_at, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!me || !me.is_active) return NextResponse.json({ error: "Cuenta deshabilitada" }, { status: 403 });
  if (!me.age_confirmed_at) {
    return NextResponse.json(
      { error: "Confirma que eres mayor de edad en Ajustes para continuar", code: "age_required" },
      { status: 403 }
    );
  }

  const { error: rateError } = await admin.rpc("check_rate", {
    p_bucket: "checkout", p_key: user.id, p_max: 20, p_window_seconds: 600,
  });
  if (rateError) return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });

  const { data: creator } = await admin
    .from("public_creators")
    .select("id, username, price_cents")
    .eq("id", body.creatorId)
    .maybeSingle();
  if (!creator) return NextResponse.json({ error: "Creador no disponible" }, { status: 404 });
  if (creator.id === user.id) return NextResponse.json({ error: "No puedes comprarte a ti mismo" }, { status: 400 });

  const { data: blocked } = await admin
    .from("blocks")
    .select("blocker_id")
    .eq("blocker_id", creator.id)
    .eq("blocked_id", user.id)
    .maybeSingle();
  if (blocked) return NextResponse.json({ error: "Creador no disponible" }, { status: 403 });

  const { data: settings } = await admin.from("platform_settings").select("currency").maybeSingle();
  const currency = (settings?.currency as string | undefined) ?? "MXN";

  let amountCents = 0;
  let postId: string | null = null;
  let message: string | null = null;
  let successPath = `/c/${creator.username}?checkout=success`;
  const cancelPath = `/c/${creator.username}?checkout=cancel`;

  if (body.kind === "subscription") {
    if (!creator.price_cents || creator.price_cents <= 0) {
      return NextResponse.json({ error: "Este creador es gratuito: usa «Seguir»" }, { status: 400 });
    }
    amountCents = creator.price_cents;
    const { data: existing } = await admin
      .from("subscriptions")
      .select("status, current_period_end, provider, cancel_at_period_end")
      .eq("fan_id", user.id)
      .eq("creator_id", creator.id)
      .maybeSingle();
    if (
      existing &&
      existing.provider !== "free" &&
      ["active", "canceled"].includes(existing.status as string) &&
      new Date(existing.current_period_end as string).getTime() > Date.now() &&
      !(existing.status === "canceled" && existing.cancel_at_period_end)
    ) {
      return NextResponse.json({ error: "Ya tienes una suscripción activa" }, { status: 409 });
    }
  } else if (body.kind === "ppv") {
    const { data: post } = await admin
      .from("posts")
      .select("id, creator_id, visibility, price_cents, is_hidden, published_at")
      .eq("id", body.postId)
      .maybeSingle();
    if (
      !post || post.creator_id !== creator.id || post.visibility !== "ppv" ||
      post.is_hidden || !post.price_cents || new Date(post.published_at as string).getTime() > Date.now()
    ) {
      return NextResponse.json({ error: "Publicación no disponible" }, { status: 404 });
    }
    const { data: bought } = await admin
      .from("purchases")
      .select("post_id")
      .eq("fan_id", user.id)
      .eq("post_id", post.id)
      .maybeSingle();
    if (bought) return NextResponse.json({ error: "Ya compraste esta publicación" }, { status: 409 });
    amountCents = post.price_cents as number;
    postId = post.id as string;
    successPath = `/post/${post.id}?checkout=success`;
  } else {
    amountCents = body.amountCents;
    message = body.message ?? null;
  }

  try {
    const provider = getPaymentProvider();
    const { url } = await provider.createCheckout({
      kind: body.kind,
      fanId: user.id,
      fanEmail: (me.email as string | null) ?? user.email ?? null,
      creatorId: creator.id,
      creatorUsername: creator.username,
      amountCents,
      currency,
      postId,
      message,
      successUrl: `${siteUrl()}${successPath}`,
      cancelUrl: `${siteUrl()}${cancelPath}`,
    });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("checkout", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos iniciar el pago. Intenta de nuevo." }, { status: 502 });
  }
}
