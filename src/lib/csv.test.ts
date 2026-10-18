import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("deja pasar texto simple", () => {
    expect(csvCell("hola")).toBe("hola");
  });

  it("entrecomilla comas, comillas y saltos de línea", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell("l1\nl2")).toBe('"l1\nl2"');
  });

  it("neutraliza inyección de fórmulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")").startsWith("\"'=")).toBe(true);
    expect(csvCell("+52 33 1234")).toBe("'+52 33 1234");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("trata null y undefined como vacío", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("incluye BOM, cabecera y filas con CRLF", () => {
    const out = toCsv(["a", "b"], [[1, "x"], [2, "y,z"]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain("a,b\r\n1,x\r\n2,\"y,z\"\r\n");
  });
});
