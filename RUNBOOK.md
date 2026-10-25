# Runbook de operación — Aura

## Tareas diarias del equipo
- **Reportes prioritarios** (menores, sin consentimiento, ilegal): la publicación ya está oculta automáticamente; revisa en Admin → Reportes y decide el mismo día. Si hay indicios de material con menores, conserva evidencia y avisa a las autoridades según tu jurisdicción.
- **Solicitudes de creadores:** Admin → Solicitudes. Compara el documento y la selfie con los datos y la fecha de nacimiento; aprueba o rechaza con motivo. Los documentos se borran solos a los 30 días de resolver.
- **Retiros:** Admin → Pagos → «Por pagar». Transfiere a la CLABE/IBAN indicada y marca «pagado» con la clave de rastreo. Un retiro solo se puede pagar con saldo liberado (retención de `hold_days`).

## Variables críticas
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (≥16 caracteres), `STRIPE_*` o credenciales de tu procesador, `PAYMENT_PROVIDER`. Nunca pongas `ALLOW_MOCK_PAYMENTS=1` con dinero real.

## Cron
`GET /api/cron/cleanup` (diario, `Authorization: Bearer $CRON_SECRET`) limpia eventos de límite de uso, auditoría vieja, suscripciones vencidas, archivos huérfanos y documentos KYC.

## Incidentes
- **Webhook caído / pagos sin acceso:** reenvía los eventos desde el panel del procesador; son idempotentes (`provider`, `provider_ref` únicos).
- **Reembolso o contracargo:** llega como `charge.refunded` / `charge.dispute.created` y revoca el acceso y el saldo asociado. Un reembolso parcial se ignora a propósito: revísalo a mano.
- **Creador abusivo:** Admin → Creadores → Suspender (cancela sus cobros recurrentes y oculta su perfil).
- **Cuenta comprometida:** Admin → Creadores → «Deshabilitar cuenta».
- **Fuga de enlaces firmados:** caducan solos (minutos); rota claves de Supabase si hay sospecha de fuga de la service key.

## Parámetros de la plataforma
Tabla `platform_settings`: `fee_bps` (comisión, 2000 = 20 %), `hold_days` (retención), `min_payout_cents`, `currency`. Cámbialos con SQL como administrador; el cambio aplica a cobros nuevos.

## Verificación continua
Job `database` de CI corre `security.test.sql` y las pruebas de API en un Supabase local. Si agregas tablas, activa RLS (la función `tables_without_rls()` lista las que falten) y añade aserciones a la suite.
