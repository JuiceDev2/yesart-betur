import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rpc = vi.fn();
const remove = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc, storage: { from: () => ({ remove }) } }),
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
    remove.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
    remove.mockResolvedValue({ error: null });
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

  it("401 sin Authorization y con x-vercel-cron falsificado (regresión)", async () => {
    expect((await call()).status).toBe(401);
    expect((await call({ "x-vercel-cron": "1" })).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("401 con un Bearer incorrecto", async () => {
    expect((await call({ authorization: "Bearer otro-secreto-distinto-largo-xx" })).status).toBe(401);
    expect((await call({ authorization: SECRET })).status).toBe(401);
  });

  it("200 con el Bearer correcto y ejecuta todas las tareas", async () => {
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    const names = rpc.mock.calls.map((c) => c[0]);
    expect(names).toEqual(
      expect.arrayContaining([
        "cleanup_rate_events", "cleanup_old_audit", "expire_subscriptions", "orphan_media_paths", "kyc_to_purge",
      ])
    );
  });

  it("borra huérfanos y marca KYC purgado", async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "orphan_media_paths") return { data: ["a/b/c.jpg"], error: null };
      if (fn === "kyc_to_purge") return { data: [{ app_id: "app1", paths: ["u/id.jpg"] }], error: null };
      return { data: null, error: null };
    });
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect(remove).toHaveBeenCalledWith(["a/b/c.jpg"]);
    expect(remove).toHaveBeenCalledWith(["u/id.jpg"]);
    expect(rpc).toHaveBeenCalledWith("mark_kyc_purged", { p_app_ids: ["app1"] });
  });

  it("500 si una tarea falla, sin lanzar excepción", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "expire_subscriptions" ? { data: null, error: { message: "boom" } } : { data: null, error: null }
    );
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(500);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(false);
  });
});
