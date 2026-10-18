/**
 * Escape user input before embedding in PostgREST .or() / .ilike filters.
 * Removes characters that alter filter structure (commas, parens, dots as operators).
 */
export function escapeFilterValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, " ")
    .replace(/[()]/g, "")
    .replace(/\./g, " ")
    .trim()
    .slice(0, 100);
}
