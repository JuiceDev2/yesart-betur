import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Pruebas a nivel API (PostgREST) contra un Supabase local con las migraciones aplicadas.
 * Se omiten si no hay variables RLS_TEST_*. La batería completa de seguridad vive en
 * supabase/tests/security.test.sql (se ejecuta con psql).
 */
const url = process.env.RLS_TEST_URL;
const anonKey = process.env.RLS_TEST_ANON_KEY;
const serviceKey = process.env.RLS_TEST_SERVICE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!enabled)("RLS / RPC vía API", () => {
  const anon = () => createClient(url!, anonKey!, opts);
  const service = () => createClient(url!, serviceKey!, opts);

  it("anon no puede leer profiles", async () => {
    const { data, error } = await anon().from("profiles").select("id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("anon no puede leer transacciones, retiros, KYC ni mensajes", async () => {
    for (const t of ["transactions", "payouts", "creator_applications", "messages", "creator_payout_accounts", "audit_log"]) {
      const { data, error } = await anon().from(t).select("*").limit(1);
      expect(error !== null || (data ?? []).length === 0, t).toBe(true);
    }
  });

  it("anon no puede registrar pagos ni reembolsos", async () => {
    const pay = await anon().rpc("record_payment", {
      p_provider: "stripe", p_provider_ref: "x", p_provider_ref_alt: null, p_kind: "tip",
      p_fan: "00000000-0000-0000-0000-000000000001", p_creator: "00000000-0000-0000-0000-000000000002",
      p_post: null, p_gross: 2000, p_currency: "MXN", p_period_end: null,
      p_provider_subscription_id: null, p_note: null,
    });
    expect(pay.error).not.toBeNull();
    const refund = await anon().rpc("record_refund", { p_provider: "stripe", p_ref: "x" });
    expect(refund.error).not.toBeNull();
  });

  it("anon no puede ejecutar RPC de administración ni helpers internos", async () => {
    expect((await anon().rpc("admin_stats")).data ?? null).toBeNull();
    expect((await anon().rpc("admin_reports", {})).error).not.toBeNull();
    expect((await anon().rpc("has_access", { p_user: "00000000-0000-0000-0000-000000000001", p_creator: "00000000-0000-0000-0000-000000000002" })).error).not.toBeNull();
    expect((await anon().rpc("check_rate", { p_bucket: "x", p_key: "y", p_max: 1, p_window_s: 1 })).error).not.toBeNull();
  });

  it("public_creators no expone correo ni datos financieros", async () => {
    const { data, error } = await anon().from("public_creators").select("*").limit(1);
    expect(error).toBeNull();
    const row = (data ?? [])[0] as Record<string, unknown> | undefined;
    if (row) {
      for (const k of ["email", "subscriber_count", "account_ref", "role"]) expect(k in row).toBe(false);
    }
  });

  it("el cliente anon no puede ver archivos privados de media/kyc", async () => {
    const { data } = await anon().storage.from("kyc").list("", { limit: 1 });
    expect((data ?? []).length).toBe(0);
    const signed = await anon().storage.from("media").createSignedUrl("x/y/z.png", 60);
    expect(signed.error).not.toBeNull();
  });

  it("service_role sí puede leer (sanidad del entorno)", async () => {
    const { error } = await service().from("platform_settings").select("fee_bps").limit(1);
    expect(error).toBeNull();
  });
});
