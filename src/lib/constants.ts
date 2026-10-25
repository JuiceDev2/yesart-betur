/** Constantes compartidas entre cliente, servidor y pruebas. Deben coincidir con las de SQL. */

export const SITE_NAME = "Aura";

export const CATEGORIES = [
  { value: "arte", label: "Arte" },
  { value: "musica", label: "Música" },
  { value: "fitness", label: "Fitness" },
  { value: "cocina", label: "Cocina" },
  { value: "gaming", label: "Gaming" },
  { value: "moda", label: "Moda" },
  { value: "educacion", label: "Educación" },
  { value: "estilo-de-vida", label: "Estilo de vida" },
  { value: "adultos", label: "Adultos (+18)" },
  { value: "otros", label: "Otros" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export function categoryLabel(v: string | null | undefined): string {
  return CATEGORIES.find((c) => c.value === v)?.label ?? "General";
}

export const RESERVED_USERNAMES = [
  "admin", "administrator", "root", "support", "soporte", "help", "ayuda", "aura", "api", "www",
  "c", "explore", "explorar", "feed", "studio", "login", "register", "registro", "settings",
  "messages", "mensajes", "post", "posts", "terms", "privacy", "legal", "account", "null",
  "undefined", "moderator", "moderacion", "staff", "official", "oficial",
] as const;

export const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

/** Precios en centavos. 0 = gratis. */
export const MIN_PRICE_CENTS = 1000;
export const MAX_PRICE_CENTS = 500000;
export const MIN_TIP_CENTS = 2000;
export const MAX_TIP_CENTS = 500000;

export const MAX_MEDIA_PER_POST = 10;
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const ALLOWED_MEDIA_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime",
] as const;
export const ALLOWED_KYC_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_KYC_BYTES = 8 * 1024 * 1024;

export const VISIBILITY_LABEL: Record<string, string> = {
  free: "Gratis",
  subscribers: "Suscriptores",
  ppv: "De pago",
};

export const REPORT_REASONS = [
  { value: "minor", label: "Aparece un menor de edad" },
  { value: "non_consensual", label: "Contenido sin consentimiento" },
  { value: "illegal", label: "Contenido ilegal" },
  { value: "copyright", label: "Derechos de autor" },
  { value: "impersonation", label: "Suplantación de identidad" },
  { value: "harassment", label: "Acoso o amenazas" },
  { value: "spam", label: "Spam o estafa" },
  { value: "other", label: "Otro motivo" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export function reportReasonLabel(v: string): string {
  return REPORT_REASONS.find((r) => r.value === v)?.label ?? v;
}

export const AGE_COOKIE = "aura_age_ok";
