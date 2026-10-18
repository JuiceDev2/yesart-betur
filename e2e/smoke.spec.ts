import { test, expect } from "@playwright/test";

/**
 * Smoke E2E público: no requiere credenciales ni datos.
 * Solo necesita la app levantada con NEXT_PUBLIC_SUPABASE_URL/ANON_KEY válidos en forma
 * (para estas pruebas no se consulta ninguna cuenta real).
 */
test.describe("público", () => {
  test("la landing muestra el título y la navegación", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Arte original y murales/i);
    await expect(page.getByRole("link", { name: /Crear cuenta/i }).first()).toBeVisible();
  });

  test("la galería carga", async ({ page }) => {
    const res = await page.goto("/gallery");
    expect(res?.status()).toBeLessThan(400);
  });

  test("privacidad y términos existen", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /privacidad/i })).toBeVisible();
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /Términos/i })).toBeVisible();
  });

  test("una ruta inexistente devuelve 404", async ({ page }) => {
    const res = await page.goto("/esto-no-existe-xyz");
    expect(res?.status()).toBe(404);
  });

  test("las rutas protegidas redirigen al login", async ({ page }) => {
    for (const path of ["/admin", "/artist", "/dashboard", "/account/delete"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });
});

test.describe("menú móvil", () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test("se abre con el botón y muestra los enlaces", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Abrir menú").click();
    await expect(page.getByRole("link", { name: /¿Eres artista\?/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar" }).first()).toBeVisible();
  });

  test("no hay scroll horizontal", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("API", () => {
  test("el cron rechaza peticiones sin secreto, incluso con x-vercel-cron falsificado", async ({
    request,
  }) => {
    const plain = await request.get("/api/cron/cleanup");
    expect([401, 500]).toContain(plain.status());
    const forged = await request.get("/api/cron/cleanup", { headers: { "x-vercel-cron": "1" } });
    expect([401, 500]).toContain(forged.status());
    expect(forged.status()).not.toBe(200);
  });

  test("POST /api/orders rechaza cuerpos inválidos", async ({ request }) => {
    const res = await request.post("/api/orders", { data: { clientName: "", clientPhone: "1" } });
    expect(res.status()).toBe(400);
  });

  test("las rutas admin rechazan a anónimos", async ({ request }) => {
    const res = await request.post("/api/admin/application", {
      data: { appId: "00000000-0000-0000-0000-000000000000", action: "approve" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("cabeceras de seguridad presentes", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-powered-by"]).toBeUndefined();
  });
});
