import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const single = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({ eq: () => ({ single }) }),
    }),
  }),
}));

import { requireAdminApi } from "./admin-guard";

describe("requireAdminApi", () => {
  beforeEach(() => {
    getUser.mockReset();
    single.mockReset();
  });

  it("401 sin sesión", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const r = await requireAdminApi();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("403 si no es admin", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    single.mockResolvedValue({ data: { role: "artist", is_active: true } });
    const r = await requireAdminApi();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("403 si es admin pero está inactivo", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    single.mockResolvedValue({ data: { role: "admin", is_active: false } });
    const r = await requireAdminApi();
    expect(r.ok).toBe(false);
  });

  it("ok si es admin activo", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    single.mockResolvedValue({ data: { role: "admin", is_active: true } });
    const r = await requireAdminApi();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.userId).toBe("u1");
  });
});
