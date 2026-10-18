/**
 * Utilidades CSV seguras.
 * - Escapa comillas, comas y saltos de línea (RFC 4180).
 * - Neutraliza "inyección de fórmulas" en Excel/Sheets: una celda que empieza
 *   con = + - @ (o tab / retorno) se prefija con un apóstrofo.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // BOM para que Excel abra bien los acentos
  return "﻿" + lines.join("\r\n") + "\r\n";
}
