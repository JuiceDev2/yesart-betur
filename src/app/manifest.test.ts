import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const pub = (p: string) => path.join(process.cwd(), "public", p);

interface Icon { src: string; sizes: string; purpose?: string }
interface Manifest {
  name?: string; short_name?: string; display?: string; start_url?: string; scope?: string;
  orientation?: string; icons?: Icon[]; shortcuts?: { url: string }[];
}
const manifest = (): Manifest => JSON.parse(fs.readFileSync(pub("manifest.webmanifest"), "utf8"));

function pngSize(file: string) {
  const buf = fs.readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe("manifest PWA", () => {
  const m = manifest();

  it("cumple lo mínimo para ser instalable", () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.display).toBe("standalone");
    expect(m.start_url?.startsWith("/")).toBe(true);
    expect(m.scope).toBe("/");
    expect(m.orientation).toBe("any");
  });

  it("incluye íconos 192 y 512 en 'any' y en 'maskable'", () => {
    const icons = m.icons ?? [];
    for (const purpose of ["any", "maskable"]) {
      for (const size of ["192x192", "512x512"]) {
        expect(icons.some((i) => i.purpose === purpose && i.sizes === size)).toBe(true);
      }
    }
  });

  it("todos los íconos y atajos existen y miden lo que declaran", () => {
    for (const icon of m.icons ?? []) {
      const file = pub(icon.src);
      expect(fs.existsSync(file), icon.src).toBe(true);
      const [w, h] = String(icon.sizes).split("x").map(Number);
      expect(pngSize(file)).toEqual({ w, h });
    }
    for (const s of m.shortcuts ?? []) expect(s.url.startsWith("/")).toBe(true);
  });

  it("los íconos maskable y el de Apple son opacos (sin esquinas transparentes)", () => {
    for (const f of ["icon-maskable-192.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
      const buf = fs.readFileSync(pub(f));
      // PNG color type en el byte 25: 2 = RGB (sin canal alfa)
      expect(buf[25], f).toBe(2);
    }
  });

  it("existen el service worker y la página offline", () => {
    expect(fs.existsSync(pub("sw.js"))).toBe(true);
    expect(fs.existsSync(pub("offline.html"))).toBe(true);
  });
});
