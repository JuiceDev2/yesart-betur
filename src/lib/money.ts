/** Utilidades de dinero. Todos los importes viajan en CENTAVOS (enteros). */

export function formatMoney(cents: number | null | undefined, currency = "MXN"): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Convierte lo que escribe una persona ("49.90", "50") a centavos; null si no es válido. */
export function parseMoneyToCents(input: string): number | null {
  const clean = input.trim().replace(/[$\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/**
 * Reparte un cobro entre plataforma y creador. Usa aritmética entera con redondeo
 * "mitad hacia arriba", igual que round() de PostgreSQL para importes positivos.
 */
export function splitFee(grossCents: number, feeBps: number): { fee: number; net: number } {
  if (!Number.isInteger(grossCents) || grossCents <= 0) throw new Error("Monto inválido");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 5000) throw new Error("Comisión inválida");
  const fee = Math.floor((2 * grossCents * feeBps + 10000) / 20000);
  return { fee, net: grossCents - fee };
}
