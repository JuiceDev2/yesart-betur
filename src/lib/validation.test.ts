import { describe, it, expect } from "vitest";
import {
  usernameSchema, registerSchema, postSchema, creatorSettingsSchema, payoutAccountSchema,
  applicationSchema, isAtLeastYearsOld, isAllowedMediaType, mediaKind, checkoutSchema,
} from "./validation";

const uuid = "123e4567-e89b-42d3-a456-426614174000";

describe("usernameSchema", () => {
  it("acepta nombres válidos", () => {
    expect(usernameSchema.safeParse("ana_lopez").success).toBe(true);
  });
  it("rechaza cortos, mayúsculas, símbolos y reservados", () => {
    for (const v of ["ab", "Ana", "a b c", "a-b-c", "x".repeat(25), "admin"]) {
      expect(usernameSchema.safeParse(v).success).toBe(false);
    }
  });
});

describe("registerSchema", () => {
  const ok = {
    displayName: "Ana", username: "ana_1", email: "a@b.co", password: "contraseña-larga",
    confirm: "contraseña-larga", age: true, terms: true,
  };
  it("acepta datos completos", () => expect(registerSchema.safeParse(ok).success).toBe(true));
  it("exige 18+ y términos", () => {
    expect(registerSchema.safeParse({ ...ok, age: undefined }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, terms: false }).success).toBe(false);
  });
  it("exige contraseñas iguales y largas", () => {
    expect(registerSchema.safeParse({ ...ok, confirm: "otra" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, password: "corta", confirm: "corta" }).success).toBe(false);
  });
});

describe("isAtLeastYearsOld", () => {
  const today = new Date("2026-06-15T12:00:00Z");
  it("calcula el cumpleaños exacto", () => {
    expect(isAtLeastYearsOld("2008-06-15", 18, today)).toBe(true);
    expect(isAtLeastYearsOld("2008-06-16", 18, today)).toBe(false);
    expect(isAtLeastYearsOld("1990-01-01", 18, today)).toBe(true);
  });
  it("rechaza fechas basura", () => {
    expect(isAtLeastYearsOld("", 18, today)).toBe(false);
    expect(isAtLeastYearsOld("no-es-fecha", 18, today)).toBe(false);
  });
});

describe("postSchema", () => {
  const base = { body: "hola", visibility: "subscribers" as const, isNsfw: false, mediaCount: 0 };
  it("acepta texto solo", () => expect(postSchema.safeParse(base).success).toBe(true));
  it("rechaza publicación vacía", () => {
    expect(postSchema.safeParse({ ...base, body: "  ", mediaCount: 0 }).success).toBe(false);
    expect(postSchema.safeParse({ ...base, body: "", mediaCount: 2 }).success).toBe(true);
  });
  it("ppv exige precio dentro de rango", () => {
    expect(postSchema.safeParse({ ...base, visibility: "ppv" }).success).toBe(false);
    expect(postSchema.safeParse({ ...base, visibility: "ppv", priceCents: 999 }).success).toBe(false);
    expect(postSchema.safeParse({ ...base, visibility: "ppv", priceCents: 1000 }).success).toBe(true);
    expect(postSchema.safeParse({ ...base, visibility: "ppv", priceCents: 500001 }).success).toBe(false);
  });
  it("máximo 10 archivos", () => {
    expect(postSchema.safeParse({ ...base, mediaCount: 11 }).success).toBe(false);
  });
});

describe("creatorSettingsSchema", () => {
  const b = { category: null, isNsfw: false };
  it("precio 0 o dentro de rango", () => {
    expect(creatorSettingsSchema.safeParse({ ...b, priceCents: 0 }).success).toBe(true);
    expect(creatorSettingsSchema.safeParse({ ...b, priceCents: 500 }).success).toBe(false);
    expect(creatorSettingsSchema.safeParse({ ...b, priceCents: 9900 }).success).toBe(true);
    expect(creatorSettingsSchema.safeParse({ ...b, priceCents: -1 }).success).toBe(false);
  });
  it("categoría debe existir", () => {
    expect(creatorSettingsSchema.safeParse({ ...b, priceCents: 0, category: "inventada" }).success).toBe(false);
    expect(creatorSettingsSchema.safeParse({ ...b, priceCents: 0, category: "arte" }).success).toBe(true);
  });
});

describe("payoutAccountSchema", () => {
  it("valida CLABE/IBAN", () => {
    expect(payoutAccountSchema.safeParse({ holderName: "Ana Pérez", accountRef: "012345678901234567" }).success).toBe(true);
    expect(payoutAccountSchema.safeParse({ holderName: "Ana Pérez", accountRef: "12 34" }).success).toBe(false);
  });
});

describe("applicationSchema", () => {
  const ok = {
    legalName: "Ana Pérez López", birthDate: "1990-05-05", country: "mx",
    confirmsRights: true as const, confirmsAdults: true as const,
  };
  it("normaliza el país y acepta adultos", () => {
    const r = applicationSchema.safeParse(ok);
    expect(r.success && r.data.country).toBe("MX");
  });
  it("rechaza menores y falta de confirmaciones", () => {
    const young = new Date();
    young.setFullYear(young.getFullYear() - 17);
    expect(applicationSchema.safeParse({ ...ok, birthDate: young.toISOString().slice(0, 10) }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...ok, confirmsRights: false }).success).toBe(false);
  });
});

describe("checkoutSchema", () => {
  it("valida cada tipo", () => {
    expect(checkoutSchema.safeParse({ kind: "subscription", creatorId: uuid }).success).toBe(true);
    expect(checkoutSchema.safeParse({ kind: "ppv", creatorId: uuid, postId: uuid }).success).toBe(true);
    expect(checkoutSchema.safeParse({ kind: "tip", creatorId: uuid, amountCents: 5000 }).success).toBe(true);
    expect(checkoutSchema.safeParse({ kind: "otro" }).success).toBe(false);
  });
});

describe("medios", () => {
  it("tipos permitidos", () => {
    expect(isAllowedMediaType("image/png")).toBe(true);
    expect(isAllowedMediaType("video/mp4")).toBe(true);
    expect(isAllowedMediaType("application/x-msdownload")).toBe(false);
    expect(isAllowedMediaType("image/svg+xml")).toBe(false);
    expect(mediaKind("video/mp4")).toBe("video");
    expect(mediaKind("image/webp")).toBe("image");
  });
});
