import { describe, it, expect } from "vitest";
import { formatMoney, parseMoneyToCents, splitFee } from "./money";

describe("parseMoneyToCents", () => {
  it("convierte importes válidos", () => {
    expect(parseMoneyToCents("49.90")).toBe(4990);
    expect(parseMoneyToCents("50")).toBe(5000);
    expect(parseMoneyToCents("$1,250.5")).toBe(125050);
    expect(parseMoneyToCents(" 0.05 ")).toBe(5);
  });
  it("rechaza lo inválido", () => {
    for (const v of ["", "abc", "-5", "1.234", "1e3", "5.", ".5"]) expect(parseMoneyToCents(v)).toBeNull();
  });
});

describe("splitFee", () => {
  it("reparte con enteros y suma exacta", () => {
    expect(splitFee(10000, 2000)).toEqual({ fee: 2000, net: 8000 });
    expect(splitFee(9999, 2000)).toEqual({ fee: 2000, net: 7999 }); // 1999.8 → 2000
    expect(splitFee(1000, 0)).toEqual({ fee: 0, net: 1000 });
  });
  it("redondea mitad hacia arriba", () => {
    expect(splitFee(1005, 1000).fee).toBe(101); // 100.5 → 101
  });
  it("fee + net siempre = bruto", () => {
    for (let g = 1; g < 3000; g += 37) {
      const { fee, net } = splitFee(g, 1750);
      expect(fee + net).toBe(g);
      expect(fee).toBeGreaterThanOrEqual(0);
    }
  });
  it("valida argumentos", () => {
    expect(() => splitFee(0, 2000)).toThrow();
    expect(() => splitFee(100.5, 2000)).toThrow();
    expect(() => splitFee(100, 6000)).toThrow();
  });
});

describe("formatMoney", () => {
  it("formatea en pesos", () => {
    expect(formatMoney(15000)).toContain("150");
    expect(formatMoney(null)).toContain("0");
  });
});
