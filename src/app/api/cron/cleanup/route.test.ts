import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

import { GET } from "./route";

const SECRET = "a-very-long-random-secret-for-tests";

function call(headers: Record<string, string> = {}) {
  return GET(new Request("http://localhost/api/cron/cleanup", { headers }));
}

describe("GET /api/cron/cleanup", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("500 si CRON_SECRET no está configurado o es muy corto", async () => {
    delete process.env.CRON_SECRET;
    expect((await call()).status).toBe(500);
    process.env.CRON_SECRET = "corto";
    expect((await call({ authorization: "Bearer corto" })).status).toBe(500);
  });

  it("401 sin Authorization", async () => {
    expect((await call()).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("401 con el encabezado x-vercel-cron falsificado (regresión)", async () => {
    const res = await call({ "x-vercel-cron": "1" });
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("401 con un Bearer incorrecto", async () => {
    expect((await call({ authorization: "Bearer otro-secreto-distinto-largo-xx" })).status).toBe(401);
    expect((await call({ authorization: SECRET })).status).toBe(401);
  });

  it("200 con el Bearer correcto y ejecuta ambas limpiezas", async () => {
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("cleanup_rate_limits");
    expect(rpc).toHaveBeenCalledWith("cleanup_old_audit", { p_days: 180 });
  });

  it("500 si una limpieza falla, sin lanzar excepción", async () => {
    rpc.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({ error: { message: "boom" } });
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });
});
