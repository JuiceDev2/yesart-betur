import { describe, it, expect } from "vitest";
import { orderBodySchema, trustedClientIp } from "./orders-api";

describe("orderBodySchema", () => {
  const base = {
    clientName: "Ana Pérez",
    clientPhone: "+52 55 1234 5678",
    consent: true as const,
    artworkId: "11111111-1111-1111-1111-111111111111",
  };

  it("accepts valid payload", () => {
    expect(orderBodySchema.safeParse(base).success).toBe(true);
  });

  it("rejects without consent", () => {
    const r = orderBodySchema.safeParse({ ...base, consent: false });
    expect(r.success).toBe(false);
  });

  it("rejects short name", () => {
    expect(orderBodySchema.safeParse({ ...base, clientName: "A" }).success).toBe(false);
  });

  it("rejects honeypot filled", () => {
    const r = orderBodySchema.safeParse({ ...base, website: "bot" });
    expect(r.success).toBe(false);
  });
});

describe("trustedClientIp", () => {
  it("prefers x-vercel-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: {
        "x-vercel-forwarded-for": "1.2.3.4, 5.6.7.8",
        "x-forwarded-for": "9.9.9.9",
      },
    });
    expect(trustedClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "10.0.0.1" },
    });
    expect(trustedClientIp(req)).toBe("10.0.0.1");
  });

  it("returns null when missing", () => {
    const req = new Request("http://localhost");
    expect(trustedClientIp(req)).toBeNull();
  });
});
