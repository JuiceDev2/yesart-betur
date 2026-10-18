# Runbook — Yesart-betur

## Primer administrador

Requiere la migración 008 aplicada. En el SQL editor de Supabase:

```sql
update public.profiles set role = 'admin', is_active = true where email = 'tu@email.com';
```

## Migraciones (orden)

001 → 002 → 003 → 004 → 005 → 006 → 007 → 008. No edites migraciones ya aplicadas: crea una nueva.

## Variables críticas (Vercel)

| Variable | Notas |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Públicas |
| `NEXT_PUBLIC_SITE_URL` | HTTPS de producción |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor** |
| `CRON_SECRET` | **Obligatoria**, ≥ 16 caracteres. Vercel la envía como Bearer al cron |
| `RESEND_API_KEY`, `EMAIL_FROM`, `OPS_EMAIL` | Opcionales (correos) |
| `NEXT_PUBLIC_CONTACT_WHATSAPP`, `NEXT_PUBLIC_CONTACT_EMAIL` | Opcionales (pie de página) |

## Cron de limpieza

`vercel.json` programa `GET /api/cron/cleanup` a diario. Para probarlo a mano:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/cron/cleanup
```

401 = secreto incorrecto o ausente · 500 = `CRON_SECRET` sin configurar o falló una limpieza (ver `results`).

## Panel admin

- **Resumen**: pendientes (solicitudes, órdenes sin atender > 48 h) y últimos eventos.
- **Solicitudes / Artistas / Órdenes / Moderación / Auditoría**: paginado en servidor, con búsqueda.
- Rechazar una solicitud y deshabilitar a un artista piden motivo; ambos quedan en la auditoría y se avisa por correo.
- Órdenes → "Exportar CSV" descarga todas (no solo la página visible).

## Incidentes

| Síntoma | Acción |
|---------|--------|
| Spam de órdenes | Revisar rate limits e IP en logs; deshabilitar artista o ítem desde Moderación |
| Artista no puede subir | `is_active = true` y `role = 'artist'` |
| `create_order` falla "Forbidden" | Confirmar migración 006/008 y service role en `/api/orders` |
| Cron responde 500 | Falta `CRON_SECRET` o una RPC de limpieza falló |
| No se puede borrar/degradar a un admin | Es el último admin activo: promueve a otro primero |
| Reset password no llega | Redirect Auth + SMTP de Supabase |
| Correos no salen | `RESEND_API_KEY`/dominio verificado; revisar logs `[email]` |

## Rotar keys

1. Generar nueva service role en Supabase
2. Actualizar Vercel
3. Redeploy
4. Revocar la anterior

## Verificación manual de `create_order`

Con la anon key, `rpc('create_order')` debe fallar. Solo `/api/orders` (service role) puede crearlas. Esto lo cubre `npm run test:rls`.
