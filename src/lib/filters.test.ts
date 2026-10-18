import { describe, it, expect } from "vitest";
import { escapeFilterValue } from "./filters";

describe("escapeFilterValue", () => {
  it("strips filter operators", () => {
    expect(escapeFilterValue("foo,bar(baz)")).toBe("foo bar baz");
  });

  it("escapes wildcards", () => {
    const out = escapeFilterValue("100%_off");
    expect(out).toContain("\\%");
    expect(out).toContain("\\_");
  });

  it("trims and limits length", () => {
    expect(escapeFilterValue("  hola  ")).toBe("hola");
    expect(escapeFilterValue("x".repeat(200)).length).toBe(100);
  });

  it("does not allow empty injection payload", () => {
    expect(escapeFilterValue(",,,,")).toBe("");
  });

  it("removes dots used as PostgREST separators", () => {
    expect(escapeFilterValue("title.eq.hack")).toBe("title eq hack");
  });
});

describe("category exact match policy", () => {
  it("documents that category uses trim only, not escapeFilterValue", () => {
    // Categories like "Pop_Art" or "100%" must survive eq() matching
    const category = "Pop_Art".trim().slice(0, 80);
    expect(category).toBe("Pop_Art");
    expect(escapeFilterValue("Pop_Art")).not.toBe("Pop_Art"); // would break eq
  });
});
