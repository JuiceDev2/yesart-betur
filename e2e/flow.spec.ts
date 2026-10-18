import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Flujo completo: un artista con una obra publicada recibe una solicitud de un visitante.
 * Se omite salvo que existan las variables de una base de PRUEBA (nunca producción):
 *   RLS_TEST_URL, RLS_TEST_SERVICE_KEY
 * y que la app apunte a esa misma base (NEXT_PUBLIC_SUPABASE_URL).
 */
const URL = process.env.RLS_TEST_URL;
const SERVICE = process.env.RLS_TEST_SERVICE_KEY;

test.describe("flujo de compra", () => {
  test.skip(!URL || !SERVICE, "Sin base de pruebas (RLS_TEST_URL / RLS_TEST_SERVICE_KEY)");

  const run = Math.random().toString(36).slice(2, 8);
  let artistId = "";
  let artworkId = "";
  const title = `Obra E2E ${run}`;

  test.beforeAll(async () => {
    const admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({
      email: `e2e-${run}@example.test`,
      password: "Test-password-123!",
      email_confirm: true,
      user_metadata: { full_name: "Artista E2E" },
    });
    if (error || !data.user) throw new Error(error?.message);
    artistId = data.user.id;
    await admin.from("profiles").update({ role: "artist", is_active: true }).eq("id", artistId);
    const art = await admin
      .from("artworks")
      .insert({ artist_id: artistId, title, price: 1500 })
      .select("id")
      .single();
    if (art.error) throw new Error(art.error.message);
    artworkId = art.data.id as string;
  });

  test.afterAll(async () => {
    const admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    if (artistId) await admin.auth.admin.deleteUser(artistId);
  });

  test("un visitante solicita una obra y la orden queda registrada", async ({ page }) => {
    await page.goto(`/artwork/${artworkId}`);
    await expect(page.getByText(title).first()).toBeVisible();

    await page.getByRole("button", { name: /Solicitar compra/i }).first().click();
    await page.getByLabel(/Nombre completo/i).fill("Visitante E2E");
    await page.getByLabel(/Teléfono/i).fill(`+52 33 ${Math.floor(10000000 + Math.random() * 89999999)}`);
    await page.locator("#consent").check();
    await page.getByRole("button", { name: "Enviar solicitud" }).click();

    await expect(page.getByText(/enviada|recibimos|gracias/i).first()).toBeVisible({
      timeout: 15000,
    });

    const admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const { data } = await admin.from("orders").select("id,status").eq("artwork_id", artworkId);
    expect(data ?? []).toHaveLength(1);
    expect(data?.[0].status).toBe("pending");
  });
});
