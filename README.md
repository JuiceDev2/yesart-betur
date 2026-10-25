# Aura — plataforma de suscripción para creadores

Versión ligera, robusta y segura de una plataforma tipo OnlyFans, construida sobre la base de Galería Viva:
**Next.js 15 (App Router) · Supabase (Postgres + RLS + Storage) · Tailwind v4 · TypeScript · zod · Vitest · Playwright**.

## Identidad visual

Ambar/dorado sobre negro cálido (tokens en `src/app/globals.css`: `--accent` dorado, `--copper`, `--bronze`), logotipo «ΛURΛ» (`src/components/Logo.tsx`), superficie lunar generada con SVG (`.moon`, sin imágenes externas), lema «Explora tu universo» e íconos PWA regenerados. Para cambiar la paleta basta editar los tokens.

## Qué incluye

- **Fans:** explorar creadores, seguir gratis o suscribirse (mensual), comprar publicaciones sueltas (PPV), propinas, feed, likes, comentarios, mensajes directos, bloqueos y reportes.
- **Creadores:** solicitud con verificación de edad/identidad (revisión manual), estudio con compositor (texto, fotos y video, vista previa pública, programación, PPV), suscriptores, bloqueo, ganancias, saldo, retiros y cuenta de cobro.
- **Admin:** resumen, revisión de solicitudes con documentos privados (enlaces de 5 min), creadores (suspender/reactivar), cola de reportes con prioridad, retiros manuales, auditoría y exportación CSV.
- **Seguridad:** puerta de edad, RLS en todas las tablas, acceso a contenido decidido en la base (`can_view_post`, `can_view_media`), archivos privados con URL firmadas, funciones de dinero solo para `service_role`, webhooks con HMAC e idempotencia, límites de uso, cron solo con `Bearer CRON_SECRET`, CSP y cabeceras.

## Puesta en marcha

1. Crea un proyecto en Supabase y aplica las migraciones **en orden** (`supabase/migrations/20250101000001…05`) con `supabase db push` o el SQL editor.
2. `cp .env.example .env.local` y completa las variables.
3. `npm install && npm run dev`.
4. Convierte tu usuario en administrador (SQL editor): `update public.profiles set role = 'admin' where email = 'tu@correo';`
5. Despliega en Vercel; `vercel.json` programa el cron diario de limpieza.

## Pagos — LEER ANTES DE COBRAR

- **Stripe prohíbe el contenido para adultos** en su acuerdo de servicio. Si tu plataforma lo permite, usa un procesador de alto riesgo (CCBill, Segpay, Epoch…) implementando `PaymentProvider` (`src/lib/payments/types.ts`) y traduciendo sus webhooks a las funciones SQL `record_payment`, `record_refund` y `set_subscription_state`. El adaptador de Stripe sirve como referencia (y para plataformas de contenido no adulto).
- `PAYMENT_PROVIDER=mock` simula cobros **solo en desarrollo**; se bloquea en producción.
- Los **retiros son manuales**: el admin transfiere y registra la referencia. No hay pagos automáticos a creadores.
- La **verificación (KYC) es revisión humana** de documentos; no hay proveedor automático de identidad.
- Los textos legales (`/terms`, `/privacy`, `/content-policy`) son **borradores** que requieren revisión de un abogado. Operar este tipo de plataforma implica obligaciones legales (verificación de edad, registros, retiro de contenido, fiscales) que dependen de tu país.

## Pruebas — qué está verificado y qué no

| Capa | Estado |
|---|---|
| Migraciones SQL (5) | Ejecutadas en Postgres 16 real con un stub de Supabase |
| `supabase/tests/security.test.sql` (100+ aserciones de RLS, triggers, dinero, moderación, storage) | Ejecutada y pasando |
| Código TypeScript/React | Solo revisión de sintaxis y de que cada import/export exista. **No se ha compilado ni ejecutado** (`npm run typecheck`, `lint`, `build` pendientes) |
| Vitest (money, validation, stripe, webhook, csv, admin-guard, cron) | Escritos, **sin ejecutar** |
| Playwright / Lighthouse / job `database` de CI | Escritos, **sin ejecutar** |

Primer paso recomendado: `npm install && npm run typecheck && npm test && npm run build` y corregir lo que aparezca.

## Scripts

`npm run dev | build | lint | typecheck | test | test:e2e | test:rls | test:lighthouse`

Pruebas SQL: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security.test.sql` (¡solo en una base de pruebas!).
