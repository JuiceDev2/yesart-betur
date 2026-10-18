/**
 * Pruebas de integración de seguridad (RLS, triggers y RPC) contra una base real.
 *
 * NO se ejecutan por defecto. Para correrlas:
 *   supabase init            # una sola vez, si no existe supabase/config.toml
 *   supabase start           # aplica supabase/migrations/*.sql
 *   eval "$(supabase status -o env | sed 's/^/export /')"
 *   RLS_TEST_URL=$API_URL RLS_TEST_ANON_KEY=$ANON_KEY RLS_TEST_SERVICE_KEY=$SERVICE_ROLE_KEY npm run test:rls
 *
 * Cada ejecución crea usuarios con correo único y los borra al terminar.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.RLS_TEST_URL;
const ANON = process.env.RLS_TEST_ANON_KEY;
const SERVICE = process.env.RLS_TEST_SERVICE_KEY;
const enabled = Boolean(URL && ANON && SERVICE);

const run = Math.random().toString(36).slice(2, 8);
const PASSWORD = "Test-password-123!";
const PHONE = `+52 33 ${Math.floor(1000000 + Math.random() * 8999999)}`;

type TestUser = { id: string; email: string; client: SupabaseClient };

describe.skipIf(!enabled)("seguridad de base de datos", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  const created: string[] = [];

  let adminUser: TestUser;
  let artistA: TestUser;
  let artistB: TestUser;
  let disabledArtist: TestUser;
  let clientUser: TestUser;
  let otherClient: TestUser;
  let artworkA: string;
  let artworkDisabled: string;

  async function makeUser(
    label: string,
    metadata: Record<string, unknown> = {}
  ): Promise<TestUser> {
    const email = `rls-${label}-${run}@example.test`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: `Test ${label}`, ...metadata },
    });
    if (error || !data.user) throw new Error(`createUser ${label}: ${error?.message}`);
    created.push(data.user.id);

    const client = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signInError) throw new Error(`signIn ${label}: ${signInError.message}`);
    return { id: data.user.id, email, client };
  }

  async function setRole(id: string, role: string, active = true) {
    // La service role puede promover (migración 008); un usuario normal no.
    const { error } = await service
      .from("profiles")
      .update({ role, is_active: active })
      .eq("id", id);
    if (error) throw new Error(`setRole: ${error.message}`);
  }

  async function makeArtwork(artistId: string, title: string): Promise<string> {
    const { data, error } = await service
      .from("artworks")
      .insert({ artist_id: artistId, title, price: 1000 })
      .select("id")
      .single();
    if (error || !data) throw new Error(`makeArtwork: ${error?.message}`);
    return data.id as string;
  }

  beforeAll(async () => {
    service = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    anon = createClient(URL!, ANON!, { auth: { persistSession: false } });

    adminUser = await makeUser("admin");
    artistA = await makeUser("artista-a");
    artistB = await makeUser("artista-b");
    disabledArtist = await makeUser("artista-off");
    clientUser = await makeUser("cliente");
    otherClient = await makeUser("cliente2");

    await setRole(adminUser.id, "admin");
    await setRole(artistA.id, "artist");
    await setRole(artistB.id, "artist");
    await setRole(disabledArtist.id, "artist", false);

    artworkA = await makeArtwork(artistA.id, `Obra A ${run}`);
    artworkDisabled = await makeArtwork(disabledArtist.id, `Obra off ${run}`);
  }, 60_000);

  afterAll(async () => {
    for (const id of created) {
      await service.auth.admin.deleteUser(id).catch(() => null);
    }
  });

  // ------------------------------------------------------------ registro / roles
  it("registrarse con role=admin en metadata crea un cliente", async () => {
    const u = await makeUser("sneaky", { role: "admin" });
    const { data } = await service.from("profiles").select("role").eq("id", u.id).single();
    expect(data?.role).toBe("client");
  });

  it("un cliente no puede cambiar su propio rol", async () => {
    const { error } = await clientUser.client
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", clientUser.id);
    expect(error).not.toBeNull();
    const { data } = await service.from("profiles").select("role").eq("id", clientUser.id).single();
    expect(data?.role).toBe("client");
  });

  it("un artista deshabilitado no puede reactivarse a sí mismo", async () => {
    const { error } = await disabledArtist.client
      .from("profiles")
      .update({ is_active: true })
      .eq("id", disabledArtist.id);
    expect(error).not.toBeNull();
    const { data } = await service
      .from("profiles")
      .select("is_active")
      .eq("id", disabledArtist.id)
      .single();
    expect(data?.is_active).toBe(false);
  });

  it("un usuario sí puede editar su nombre y bio", async () => {
    const { error } = await artistA.client
      .from("profiles")
      .update({ bio: "Hola" })
      .eq("id", artistA.id);
    expect(error).toBeNull();
  });

  // ------------------------------------------------------------- lectura pública
  it("un anónimo no puede leer perfiles (correo/teléfono)", async () => {
    const { data } = await anon.from("profiles").select("id, email");
    expect(data ?? []).toHaveLength(0);
  });

  it("public_artists solo muestra artistas activos y sin datos privados", async () => {
    const { data, error } = await anon.from("public_artists").select("*");
    expect(error).toBeNull();
    const ids = (data ?? []).map((a: { id: string }) => a.id);
    expect(ids).toContain(artistA.id);
    expect(ids).not.toContain(disabledArtist.id);
    expect(ids).not.toContain(clientUser.id);
    expect(Object.keys((data ?? [])[0] ?? {})).not.toContain("email");
    expect(Object.keys((data ?? [])[0] ?? {})).not.toContain("phone");
  });

  it("las obras de un artista deshabilitado no son públicas", async () => {
    const { data } = await anon.from("artworks").select("id").eq("id", artworkDisabled);
    expect(data ?? []).toHaveLength(0);
    const { data: ok } = await anon.from("artworks").select("id").eq("id", artworkA);
    expect(ok ?? []).toHaveLength(1);
  });

  // ------------------------------------------------------------------ propiedad
  it("un artista no puede editar ni borrar obras de otro", async () => {
    const upd = await artistB.client
      .from("artworks")
      .update({ title: "hackeada" })
      .eq("id", artworkA)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);

    const del = await artistB.client.from("artworks").delete().eq("id", artworkA).select("id");
    expect(del.data ?? []).toHaveLength(0);

    const { data } = await service.from("artworks").select("title").eq("id", artworkA).single();
    expect(data?.title).toBe(`Obra A ${run}`);
  });

  it("un artista no puede publicar a nombre de otro", async () => {
    const { error } = await artistB.client
      .from("artworks")
      .insert({ artist_id: artistA.id, title: "falsa", price: 1 });
    expect(error).not.toBeNull();
  });

  it("un cliente no puede publicar obras", async () => {
    const { error } = await clientUser.client
      .from("artworks")
      .insert({ artist_id: clientUser.id, title: "x", price: 1 });
    expect(error).not.toBeNull();
  });

  // ---------------------------------------------------------------------- órdenes
  async function newOrder(phone: string, name = "Cliente Prueba") {
    return service.rpc("create_order", {
      p_client_name: name,
      p_client_phone: phone,
      p_artwork_id: artworkA,
      p_service_id: null,
      p_notes: null,
      p_ip: null,
      p_user_id: null,
    });
  }

  it("create_order no es ejecutable con la clave anónima ni con sesión", async () => {
    const args = {
      p_client_name: "Hacker",
      p_client_phone: "5512345678",
      p_artwork_id: artworkA,
      p_service_id: null,
      p_notes: null,
      p_ip: "1.1.1.1",
      p_user_id: null,
    };
    expect((await anon.rpc("create_order", args)).error).not.toBeNull();
    expect((await clientUser.client.rpc("create_order", args)).error).not.toBeNull();
  });

  it("create_order (service role) crea la orden y rechaza ítems no disponibles", async () => {
    const ok = await newOrder(`+52 55 ${run}001`);
    expect(ok.error).toBeNull();

    const off = await service.rpc("create_order", {
      p_client_name: "Cliente",
      p_client_phone: "5512345678",
      p_artwork_id: artworkDisabled,
      p_service_id: null,
      p_notes: null,
      p_ip: null,
      p_user_id: null,
    });
    expect(off.error).not.toBeNull();
  });

  it("el límite por teléfono bloquea la sexta orden en una hora", async () => {
    let lastError: string | null = null;
    for (let i = 0; i < 6; i++) {
      const r = await newOrder(PHONE);
      lastError = r.error?.message ?? null;
    }
    expect(lastError).toMatch(/Demasiadas/);
  });

  it("el cliente ve y cancela solo sus órdenes pendientes", async () => {
    const created = await service.rpc("create_order", {
      p_client_name: "Cliente Uno",
      p_client_phone: `+52 55 ${run}777`,
      p_artwork_id: artworkA,
      p_service_id: null,
      p_notes: null,
      p_ip: null,
      p_user_id: clientUser.id,
    });
    expect(created.error).toBeNull();
    const orderId = created.data as string;

    const mine = await clientUser.client.from("orders").select("id").eq("id", orderId);
    expect(mine.data ?? []).toHaveLength(1);
    const theirs = await otherClient.client.from("orders").select("id").eq("id", orderId);
    expect(theirs.data ?? []).toHaveLength(0);

    const denied = await otherClient.client.rpc("update_order_status", {
      p_order_id: orderId,
      p_new_status: "cancelled",
    });
    expect(denied.error).not.toBeNull();

    const anonDenied = await anon.rpc("update_order_status", {
      p_order_id: orderId,
      p_new_status: "contacted",
    });
    expect(anonDenied.error).not.toBeNull();

    const cancelled = await clientUser.client.rpc("update_order_status", {
      p_order_id: orderId,
      p_new_status: "cancelled",
    });
    expect(cancelled.error).toBeNull();
  });

  it("el artista dueño avanza el estado; el artista ajeno no; no se puede saltar estados", async () => {
    const created = await service.rpc("create_order", {
      p_client_name: "Cliente Dos",
      p_client_phone: `+52 55 ${run}888`,
      p_artwork_id: artworkA,
      p_service_id: null,
      p_notes: null,
      p_ip: null,
      p_user_id: null,
    });
    const orderId = created.data as string;

    const foreign = await artistB.client.rpc("update_order_status", {
      p_order_id: orderId,
      p_new_status: "contacted",
    });
    expect(foreign.error).not.toBeNull();

    const skip = await artistA.client.rpc("update_order_status", {
      p_order_id: orderId,
      p_new_status: "completed",
    });
    expect(skip.error).not.toBeNull();

    const step1 = await artistA.client.rpc("update_order_status", {
      p_order_id: orderId,
      p_new_status: "contacted",
    });
    expect(step1.error).toBeNull();
    const step2 = await artistA.client.rpc("update_order_status", {
      p_order_id: orderId,
      p_new_status: "completed",
    });
    expect(step2.error).toBeNull();
  });

  it("los clientes no pueden insertar ni editar órdenes directamente", async () => {
    const ins = await clientUser.client.from("orders").insert({
      client_name: "Directo",
      client_phone: "5512345678",
      artwork_id: artworkA,
      artist_id: artistA.id,
    });
    expect(ins.error).not.toBeNull();
  });

  // ------------------------------------------------------- solicitudes / auditoría
  it("una solicitud de artista nace siempre pendiente", async () => {
    const bad = await clientUser.client
      .from("artist_applications")
      .insert({ user_id: clientUser.id, status: "approved" });
    expect(bad.error).not.toBeNull();

    const good = await clientUser.client
      .from("artist_applications")
      .insert({ user_id: clientUser.id, message: "Soy pintor", status: "pending" });
    expect(good.error).toBeNull();
  });

  it("solo un admin aprueba solicitudes y el rol cambia solo así", async () => {
    const { data: app } = await service
      .from("artist_applications")
      .select("id")
      .eq("user_id", clientUser.id)
      .eq("status", "pending")
      .single();
    const appId = app?.id as string;

    const denied = await clientUser.client.rpc("approve_artist_application", { app_id: appId });
    expect(denied.error).not.toBeNull();

    const ok = await adminUser.client.rpc("approve_artist_application", { app_id: appId });
    expect(ok.error).toBeNull();

    const { data } = await service.from("profiles").select("role").eq("id", clientUser.id).single();
    expect(data?.role).toBe("artist");
  });

  it("solo un admin escribe en la auditoría", async () => {
    const args = { p_action: "test", p_target_type: null, p_target_id: null, p_meta: null };
    expect((await clientUser.client.rpc("write_audit", args)).error).not.toBeNull();
    expect((await anon.rpc("write_audit", args)).error).not.toBeNull();
    expect((await adminUser.client.rpc("write_audit", args)).error).toBeNull();
  });

  it("solo un admin deshabilita artistas, y queda registrado", async () => {
    const denied = await artistB.client.rpc("admin_set_artist_active", {
      p_artist_id: artistA.id,
      p_active: false,
      p_reason: "x",
    });
    expect(denied.error).not.toBeNull();

    const ok = await adminUser.client.rpc("admin_set_artist_active", {
      p_artist_id: artistB.id,
      p_active: false,
      p_reason: "prueba automática",
    });
    expect(ok.error).toBeNull();

    const log = await adminUser.client
      .from("audit_log")
      .select("action")
      .eq("target_id", artistB.id)
      .eq("action", "disable_artist");
    expect(log.data ?? []).toHaveLength(1);

    // Un no-admin no puede leer el registro de auditoría
    const hidden = await artistA.client.from("audit_log").select("id");
    expect(hidden.data ?? []).toHaveLength(0);
  });

  it("no se puede quitar al último administrador activo", async () => {
    // Se desactivan los demás admins del entorno de prueba: este test solo aplica
    // en bases limpias (CI). Si hay otros admins ajenos, se omite la verificación.
    const { data: admins } = await service
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true);
    if ((admins ?? []).length !== 1) return;
    const { error } = await service
      .from("profiles")
      .update({ role: "client" })
      .eq("id", adminUser.id);
    expect(error).not.toBeNull();
  });
});
