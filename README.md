# Yesart-betur

Marketplace de arte original y murales. Next.js 15 · TypeScript · Supabase · Tailwind v4 · Vercel.
Roles: **admin**, **artista**, **cliente**. Los visitantes pueden solicitar una obra o un servicio sin cuenta.

## Arranque

```bash
cp .env.example .env.local     # completar Supabase, SITE_URL y CRON_SECRET
npm ci
npm run dev
```

### Migraciones Supabase (orden estricto)

1. `20241017000001_init_secure_schema.sql`
2. `20241017000002_storage_policies.sql`
3. `20241017000003_security_fixes.sql`
4. `20241017000004_audit_orders_storage.sql`
5. `20241017000005_ip_rate_limit.sql`
6. `20241017000006_lock_create_order.sql`
7. `20241017000007_indexes_and_retention.sql`
8. `20241017000008_hardening_and_account_lifecycle.sql`

La **008 es obligatoria**: arregla el alta del primer admin (el trigger de protección bloqueaba incluso al SQL editor), borra las versiones antiguas de `create_order`, hace que `orders.artist_id` sobreviva al borrado de un artista y añade las funciones de admin con auditoría y la protección del último administrador.

Auth → Redirect URLs: `https://TU-DOMINIO/auth/callback` y `http://localhost:3000/auth/callback`.

Primer administrador (SQL editor de Supabase):

```sql
update public.profiles set role = 'admin', is_active = true where email = 'tu@email.com';
```

## Variables de entorno

Ver `.env.example`. Obligatorias en producción: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (https) y **`CRON_SECRET`** (≥ 16 caracteres; sin ella el cron responde 500).
Opcionales: `RESEND_API_KEY`, `EMAIL_FROM`, `OPS_EMAIL`, `NEXT_PUBLIC_CONTACT_WHATSAPP`, `NEXT_PUBLIC_CONTACT_EMAIL`.

## Scripts

```bash
npm run lint
npm run typecheck
npm test                 # unitarias (vitest); las de base de datos se omiten sin entorno
npm run build
npm run test:e2e         # Playwright (smoke público; flow.spec.ts requiere base de pruebas)
npm run test:rls         # seguridad contra una base Supabase de PRUEBA
npm run test:lighthouse  # Lighthouse CI (requiere `npm run build` previo)
```

### Pruebas de seguridad en base de datos

`src/tests/rls.integration.test.ts` ejecuta contra una base real: escalada de rol, lectura pública, propiedad de obras, `create_order` cerrado al público y límite por teléfono, transiciones de estado, solicitudes de artista, auditoría y último admin.

```bash
supabase init            # una vez
supabase start
eval "$(supabase status -o env | sed 's/^/export /')"
RLS_TEST_URL=$API_URL RLS_TEST_ANON_KEY=$ANON_KEY RLS_TEST_SERVICE_KEY=$SERVICE_ROLE_KEY npm run test:rls
```

**Nunca** apuntes estas variables a producción: las pruebas crean y borran usuarios.

## Seguridad (resumen)

- `create_order` solo es ejecutable con la service role, desde `POST /api/orders`; las versiones antiguas se eliminan.
- Límite por teléfono, usuario e IP. Sin captcha.
- Cron `GET /api/cron/cleanup`: únicamente `Authorization: Bearer $CRON_SECRET` (comparación en tiempo constante). El encabezado `x-vercel-cron` **no** se acepta.
- Rutas `/api/admin/*` pasan por `requireAdminApi()` (admin activo) y los datos sensibles (correos) se leen de la base, nunca del cuerpo de la petición.
- Los correos se envían dentro de `after()`, así no se pierden en serverless.
- Eliminar cuenta: borra primero el usuario (cascada), luego anonimiza las órdenes propias y limpia Storage; el último admin activo no puede eliminarse.
- CSP sin `unsafe-eval` en producción, `object-src 'none'`, `upgrade-insecure-requests`.
- Exportación CSV protegida contra inyección de fórmulas.

## Estado de verificación (honesto)

Esta versión se editó **sin poder ejecutar** `npm install`, `lint`, `typecheck`, `build` ni las pruebas (entorno sin acceso al registro de npm). Antes de desplegar, corre en tu máquina o en CI: `npm ci && npm run lint && npm run typecheck && npm test && npm run build`, aplica la migración 008 y ejecuta `npm run test:rls` contra una base de pruebas. Los jobs de CI (`e2e`, `lighthouse`, `database`) están escritos pero aún no se han visto en verde.

## Observabilidad

`src/instrumentation.ts` registra cada error de servidor como una línea JSON (`onRequestError`). Para Sentry: `npx @sentry/wizard@latest -i nextjs` (añade dependencia; hazlo cuando lo decidas).

## Operación

Ver **RUNBOOK.md**.

## Checklist de despliegue

- [ ] Migraciones 001–008 aplicadas
- [ ] Bucket de Storage + políticas
- [ ] Variables en Vercel (incl. `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Auth redirects
- [ ] Primer admin creado
- [ ] CI en verde (quality, e2e, lighthouse, database)
- [ ] Orden de prueba de punta a punta
