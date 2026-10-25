import { test, expect } from "@playwright/test";

/**
 * Smoke E2E público: no requiere credenciales ni datos. La app debe estar levantada con
 * NEXT_PUBLIC_SUPABASE_URL/ANON_KEY con forma válida (no se consulta ninguna cuenta real).
 * La puerta de edad se salta con la cookie que fija el propio flujo.
 */
test.use({ storageState: { cookies: [], origins: [] } });

async function passAgeGate(page: import("@playwright/test").Page) {
  const btn = page.getByRole("button", { name: /tengo 18|soy mayor|entrar/i }).first();
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

test.describe("público", () => {
  test("la puerta de edad aparece en la primera visita", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("la landing se ve tras confirmar la edad", async ({ page }) => {
    await page.goto("/");
    await passAgeGate(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /crear cuenta|empezar|regístrate/i }).first()).toBeVisible();
  });

  test("explorar carga", async ({ page }) => {
    const res = await page.goto("/explore");
    expect(res?.status()).toBeLessThan(400);
  });

  test("páginas legales existen", async ({ page }) => {
    for (const [path, h] of [["/terms", /Términos/i], ["/privacy", /privacidad/i], ["/content-policy", /contenido/i]] as const) {
      await page.goto(path);
      await passAgeGate(page);
      await expect(page.getByRole("heading", { level: 1, name: h })).toBeVisible();
    }
  });

  test("una ruta inexistente devuelve 404", async ({ page }) => {
    const res = await page.goto("/esto-no-existe-xyz");
    expect(res?.status()).toBe(404);
  });

  test("las rutas protegidas redirigen al login", async ({ page }) => {
    for (const path of ["/feed", "/studio", "/admin", "/subscriptions", "/messages", "/settings", "/become-creator"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("el cron rechaza peticiones sin secreto, incluso con cabeceras falsas", async ({ request }) => {
    expect((await request.get("/api/cron/cleanup")).status()).toBe(401);
    expect((await request.get("/api/cron/cleanup", { headers: { "x-vercel-cron": "1" } })).status()).toBe(401);
  });

  test("las APIs sensibles exigen sesión", async ({ request }) => {
    expect((await request.post("/api/checkout", { data: { kind: "subscription" } })).status()).toBe(401);
    expect((await request.get("/api/admin/transactions-csv")).status()).toBeGreaterThanOrEqual(401);
  });

  test("el webhook rechaza firmas inválidas", async ({ request }) => {
    const res = await request.post("/api/webhooks/stripe", {
      data: "{}",
      headers: { "stripe-signature": "t=1,v1=deadbeef", "content-type": "application/json" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("cabeceras de seguridad presentes", async ({ request }) => {
    const res = await request.get("/terms");
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("el menú móvil funciona", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto("/");
    await passAgeGate(page);
    await page.locator("summary").first().click();
    await expect(page.getByRole("link", { name: /explorar/i }).first()).toBeVisible();
  });
});
