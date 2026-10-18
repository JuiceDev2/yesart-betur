import { z } from "zod";

export const orderBodySchema = z.object({
  clientName: z.string().trim().min(2).max(120),
  clientPhone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^[+\d\s()-]+$/),
  notes: z.string().max(1000).optional().nullable(),
  artworkId: z.string().uuid().optional().nullable(),
  serviceId: z.string().uuid().optional().nullable(),
  website: z.string().max(0).optional().nullable(),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar el aviso de privacidad" }),
  }),
});

export type OrderBody = z.infer<typeof orderBodySchema>;

/** Prefer platform-injected headers (harder to spoof). */
export function trustedClientIp(request: Request): string | null {
  const h = request.headers;
  const vercel = h.get("x-vercel-forwarded-for");
  if (vercel) {
    return vercel.split(",")[0]?.trim().slice(0, 45) || null;
  }
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 45);
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim().slice(0, 45) || null;
  }
  return null;
}
