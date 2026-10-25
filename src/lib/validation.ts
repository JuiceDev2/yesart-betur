import { z } from "zod";
import {
  ALLOWED_MEDIA_TYPES,
  CATEGORIES,
  MAX_PRICE_CENTS,
  MAX_TIP_CENTS,
  MIN_PRICE_CENTS,
  MIN_TIP_CENTS,
  REPORT_REASONS,
  RESERVED_USERNAMES,
  USERNAME_REGEX,
} from "@/lib/constants";

const uuid = z.string().uuid();

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_REGEX, "3 a 24 caracteres: letras minúsculas, números y guion bajo")
  .refine((u) => !(RESERVED_USERNAMES as readonly string[]).includes(u), "Ese nombre de usuario no está disponible");

/** Registro de cuenta (cliente). */
export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, "Escribe tu nombre").max(60),
    username: usernameSchema,
    email: z.string().trim().email("Correo inválido"),
    password: z.string().min(10, "Mínimo 10 caracteres"),
    confirm: z.string(),
    age: z.literal(true, { errorMap: () => ({ message: "Debes confirmar que eres mayor de edad" }) }),
    terms: z.literal(true, { errorMap: () => ({ message: "Debes aceptar los términos y la política de contenido" }) }),
  })
  .refine((d) => d.password === d.confirm, { message: "Las contraseñas no coinciden", path: ["confirm"] });

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Escribe tu nombre").max(60),
  username: usernameSchema,
  bio: z.string().trim().max(1000, "Máximo 1000 caracteres").optional().nullable(),
});

/** Checkout: la fuente de verdad de los precios es la base de datos, no el cliente. */
export const checkoutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("subscription"), creatorId: uuid }),
  z.object({ kind: z.literal("ppv"), creatorId: uuid, postId: uuid }),
  z.object({
    kind: z.literal("tip"),
    creatorId: uuid,
    amountCents: z
      .number()
      .int("Importe inválido")
      .min(MIN_TIP_CENTS, "La propina mínima es de $20")
      .max(MAX_TIP_CENTS, "La propina máxima es de $5,000"),
    message: z.string().trim().max(200).optional().nullable(),
  }),
]);
export type CheckoutBody = z.infer<typeof checkoutSchema>;

export const cancelSubscriptionSchema = z.object({ creatorId: uuid });
export const blockSchema = z.object({ fanId: uuid, blocked: z.boolean() });

/** Publicación (composer del estudio). */
export const postSchema = z
  .object({
    body: z.string().trim().max(5000, "Máximo 5000 caracteres"),
    teaser: z.string().trim().max(200, "Máximo 200 caracteres").optional().nullable(),
    visibility: z.enum(["free", "subscribers", "ppv"]),
    priceCents: z.number().int().optional().nullable(),
    isNsfw: z.boolean(),
    publishAt: z.string().datetime({ offset: true }).optional().nullable(),
    mediaCount: z.number().int().min(0).max(10),
  })
  .superRefine((d, ctx) => {
    if (d.body.length === 0 && d.mediaCount === 0) {
      ctx.addIssue({ code: "custom", path: ["body"], message: "Escribe algo o adjunta al menos un archivo" });
    }
    if (d.visibility === "ppv") {
      if (d.priceCents == null || d.priceCents < MIN_PRICE_CENTS || d.priceCents > MAX_PRICE_CENTS) {
        ctx.addIssue({ code: "custom", path: ["priceCents"], message: "El precio debe estar entre $10 y $5,000" });
      }
    }
  });

export const creatorSettingsSchema = z.object({
  priceCents: z
    .number()
    .int()
    .refine((p) => p === 0 || (p >= MIN_PRICE_CENTS && p <= MAX_PRICE_CENTS), "El precio debe ser $0 (gratis) o entre $10 y $5,000"),
  category: z.enum(CATEGORIES.map((c) => c.value) as [string, ...string[]]).nullable(),
  isNsfw: z.boolean(),
  welcomeMessage: z.string().trim().max(500).optional().nullable(),
});

export const payoutAccountSchema = z.object({
  holderName: z.string().trim().min(2, "Escribe el nombre del titular").max(120),
  accountRef: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{8,34}$/, "CLABE o IBAN: solo letras y números (8 a 34)"),
  bankName: z.string().trim().max(80).optional().nullable(),
});

export const reportSchema = z.object({
  targetType: z.enum(["post", "creator", "comment", "message"]),
  targetId: uuid,
  reason: z.enum(REPORT_REASONS.map((r) => r.value) as [string, ...string[]]),
  details: z.string().trim().max(1000).optional().nullable(),
});

/** Solicitud para ser creador (verificación de identidad y edad). */
export const applicationSchema = z.object({
  legalName: z.string().trim().min(3, "Escribe tu nombre legal completo").max(120),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .refine((d) => isAtLeastYearsOld(d, 18), "Debes tener al menos 18 años"),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Usa el código de país de 2 letras (por ejemplo, MX)"),
  message: z.string().trim().max(1000).optional().nullable(),
  confirmsRights: z.literal(true, { errorMap: () => ({ message: "Debes confirmar que tienes los derechos del contenido" }) }),
  confirmsAdults: z.literal(true, { errorMap: () => ({ message: "Debes confirmar que todas las personas que aparecen son mayores de 18 años y dieron su consentimiento" }) }),
});

export function isAtLeastYearsOld(isoDate: string, years: number, today = new Date()): boolean {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return false;
  const born = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(born.getTime()) || born.getUTCFullYear() < 1900) return false;
  const limit = new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate()));
  return born.getTime() <= limit.getTime();
}

export function isAllowedMediaType(type: string): boolean {
  return (ALLOWED_MEDIA_TYPES as readonly string[]).includes(type);
}

export function mediaKind(type: string): "image" | "video" {
  return type.startsWith("video/") ? "video" : "image";
}

/** Extensión segura para el nombre del archivo en Storage (nunca confiamos en el nombre original). */
export function extensionForType(type: string): string {
  switch (type) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    case "video/mp4": return "mp4";
    case "video/webm": return "webm";
    case "video/quicktime": return "mov";
    case "application/pdf": return "pdf";
    default: return "bin";
  }
}
