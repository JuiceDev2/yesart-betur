-- =============================================================================
-- Pruebas de seguridad de la base de datos (RLS, triggers, RPC y almacenamiento)
--
-- Se ejecutan con psql contra una base con las migraciones aplicadas. Cada aserción
-- lanza una excepción si falla; psql termina con error (ON_ERROR_STOP).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security.test.sql
--
-- ¡USAR SOLO EN BASES DE PRUEBA! Crea usuarios y datos y al final los borra.
-- =============================================================================
\set ON_ERROR_STOP 1
\set QUIET 1

drop schema if exists t cascade;
create schema t;
grant usage on schema t to public;

create table t.ids (name text primary key, id uuid not null);
grant select on t.ids to public;
create function t.id(p text) returns uuid language sql stable as $$ select id from t.ids where name = p $$;

create function t.login(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', t.id(p)::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  execute 'set role authenticated';
end $$;
create function t.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'anon', false);
  execute 'set role anon';
end $$;
create function t.service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'service_role', false);
  execute 'set role service_role';
end $$;
create function t.reset() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', '', false);
end $$;
create function t.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if c is not true then raise exception 'FALLÓ: %', msg; end if;
end $$;
create function t.fails(q text, expect text default null) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if expect is not null and sqlerrm not ilike '%' || expect || '%' then
      raise exception 'FALLÓ: error inesperado en [%]: %', q, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FALLÓ: se esperaba un error en [%]', q;
end $$;
create function t.n(q text) returns bigint language plpgsql as $$
declare r bigint;
begin execute 'select count(*) from (' || q || ') x' into r; return r; end $$;

-- ---------------------------------------------------------------- usuarios
insert into t.ids values
  ('admin', gen_random_uuid()), ('cA', gen_random_uuid()), ('cB', gen_random_uuid()),
  ('cOff', gen_random_uuid()), ('f1', gen_random_uuid()), ('f2', gen_random_uuid()),
  ('fNoAge', gen_random_uuid()), ('kid', gen_random_uuid());

insert into auth.users (id, email, raw_user_meta_data)
select t.id(n), n || '@test.dev',
       jsonb_build_object('display_name', 'U ' || n, 'username', 'u_' || lower(n),
                          'age_confirmed', case when n = 'fNoAge' then 'false' else 'true' end,
                          'terms_accepted', 'true',
                          'role', 'admin')  -- intento de escalada vía metadata
from unnest(array['admin','cA','cB','cOff','f1','f2','fNoAge','kid']) n;

do $$ begin
  -- el rol del metadata se ignora
  perform t.ok((select count(*) from public.profiles where role <> 'fan') = 0, 'registro con role=admin debe crear fan');
  perform t.ok((select username from public.profiles where id = t.id('cA')) = 'u_ca', 'username desde metadata');
  perform t.ok((select age_confirmed_at from public.profiles where id = t.id('fNoAge')) is null, 'sin confirmar edad');
  -- username repetido o reservado → alias automático
  insert into auth.users (id, email, raw_user_meta_data)
    values (gen_random_uuid(), 'dup@test.dev', '{"username":"u_ca"}'), (gen_random_uuid(), 'res@test.dev', '{"username":"admin"}');
  perform t.ok((select count(*) from public.profiles where username like 'user\_%') = 2, 'alias automático');
  delete from auth.users where email in ('dup@test.dev', 'res@test.dev');
end $$;

-- Promover al administrador (contexto de servidor: SQL editor / service role)
update public.profiles set role = 'admin' where id = t.id('admin');

-- ------------------------------------------------- perfiles: columnas protegidas
select t.login('f1');
do $$
declare n int;
begin
  perform t.fails($q$update public.profiles set role = 'admin' where id = t.id('f1')$q$, 'No autorizado');
  perform t.fails($q$update public.profiles set is_active = false where id = t.id('f1')$q$, 'No autorizado');
  perform t.fails($q$update public.profiles set age_confirmed_at = null where id = t.id('f1')$q$, 'No autorizado');
  update public.profiles set bio = 'hola' where id = t.id('f1');
  perform t.ok((select bio from public.profiles where id = t.id('f1')) = 'hola', 'puede editar su bio');
  perform t.ok(t.n('select 1 from public.profiles') = 1, 'solo ve su propio perfil');
  update public.profiles set bio = 'x' where id = t.id('f2');
  get diagnostics n = row_count;
  perform t.ok(n = 0, 'no puede editar el perfil ajeno');
end $$;
select t.reset();

select t.anon();
do $$ begin
  perform t.ok(t.n('select 1 from public.profiles') = 0, 'anónimo no lee perfiles');
  perform t.fails($q$select public.has_access(gen_random_uuid(), gen_random_uuid())$q$, 'permission denied');
  perform t.fails($q$select public.is_adult_user(gen_random_uuid())$q$, 'permission denied');
  perform t.fails($q$select public.record_payment('x','y',null,'tip',null,null,null,100,'MXN')$q$, 'permission denied');
end $$;
select t.reset();

-- confirmar mayoría de edad (RPC) para quien no lo hizo
select t.login('fNoAge');
do $$ begin
  perform t.ok(not public.me_adult(), 'aún no es adulto');
  perform public.confirm_adult();
  perform t.ok(public.me_adult(), 'confirm_adult funciona');
end $$;
select t.reset();

-- ------------------------------------------- solicitudes de creador y aprobación
select t.login('kid');
do $$ begin
  perform t.fails(format($q$insert into public.creator_applications (user_id, legal_name, birth_date, country, id_doc_path, selfie_path, confirms_rights, confirms_adults)
    values (%L, 'Menor Edad', current_date - interval '17 years', 'MX', %L, %L, true, true)$q$,
    t.id('kid'), t.id('kid') || '/id.jpg', t.id('kid') || '/selfie.jpg'), '18 años');
  perform t.fails(format($q$insert into public.creator_applications (user_id, legal_name, birth_date, country, id_doc_path, selfie_path, confirms_rights, confirms_adults)
    values (%L, 'Ajeno Path', date '1990-01-01', 'MX', %L, %L, true, true)$q$,
    t.id('kid'), t.id('f2') || '/id.jpg', t.id('f2') || '/selfie.jpg'));
  perform t.fails(format($q$insert into public.creator_applications (user_id, legal_name, birth_date, country, id_doc_path, selfie_path, confirms_rights, confirms_adults, status)
    values (%L, 'Auto Aprobada', date '1990-01-01', 'MX', %L, %L, true, true, 'approved')$q$,
    t.id('kid'), t.id('kid') || '/id.jpg', t.id('kid') || '/selfie.jpg'));
end $$;
select t.reset();

do $$
declare n text; app uuid;
begin
  foreach n in array array['cA','cB','cOff'] loop
    perform t.login(n);
    insert into public.creator_applications (user_id, legal_name, birth_date, country, id_doc_path, selfie_path, confirms_rights, confirms_adults)
    values (t.id(n), 'Persona ' || n, date '1990-05-05', 'MX', t.id(n) || '/id.jpg', t.id(n) || '/selfie.jpg', true, true);
    perform t.fails(format($q$insert into public.creator_applications (user_id, legal_name, birth_date, country, id_doc_path, selfie_path, confirms_rights, confirms_adults)
      values (%L, 'Duplicada', date '1990-05-05', 'MX', %L, %L, true, true)$q$, t.id(n), t.id(n) || '/a.jpg', t.id(n) || '/b.jpg'));
    perform t.reset();
  end loop;
  -- un fan no aprueba; un tercero no ve solicitudes ajenas
  perform t.login('f1');
  perform t.ok(t.n('select 1 from public.creator_applications') = 0, 'fan no ve solicitudes ajenas');
  select id into app from public.creator_applications limit 1;
  perform t.reset();
  select id into app from public.creator_applications where user_id = t.id('cA');
  perform t.login('f1');
  perform t.fails(format('select public.admin_review_application(%L, true, null)', app), 'Solo administradores');
  perform t.reset();
  -- el administrador aprueba
  perform t.login('admin');
  for app in select id from public.creator_applications where status = 'pending' loop
    perform public.admin_review_application(app, true, 'ok');
  end loop;
  perform t.reset();
  perform t.ok((select count(*) from public.creators) = 3, 'se crearon 3 creadores');
  perform t.ok((select role from public.profiles where id = t.id('cA')) = 'creator', 'rol creator');
end $$;

-- precios y banderas del creador
select t.login('cA');
do $$ begin
  update public.creators set price_cents = 5000, category = 'arte' where user_id = t.id('cA');
  perform t.fails($q$update public.creators set price_cents = 50 where user_id = (select auth.uid())$q$, 'check');
  perform t.fails($q$update public.creators set status = 'suspended' where user_id = (select auth.uid())$q$, 'No autorizado');
end $$;
select t.reset();
select t.login('cOff');
update public.creators set price_cents = 3000 where user_id = t.id('cOff');
select t.reset();
-- cB queda gratis

-- ------------------------------------------------------------- publicaciones
select t.login('cA');
do $$
declare cA uuid := t.id('cA'); p uuid;
begin
  insert into public.posts (id, creator_id, body, visibility) values
    ('00000000-0000-0000-0000-00000000f001', cA, 'post libre', 'free'),
    ('00000000-0000-0000-0000-00000000f002', cA, 'post suscriptores', 'subscribers'),
    ('00000000-0000-0000-0000-00000000f003', cA, 'post ppv', 'free');
  update public.posts set visibility = 'ppv', price_cents = 2500 where id = '00000000-0000-0000-0000-00000000f003';
  perform t.fails($q$insert into public.posts (creator_id, body, visibility, price_cents) values ((select auth.uid()), 'x', 'ppv', null)$q$, 'check');
  perform t.fails($q$insert into public.posts (creator_id, body, visibility, price_cents) values ((select auth.uid()), 'x', 'free', 1500)$q$, 'check');
  insert into public.posts (id, creator_id, body, visibility, is_nsfw) values
    ('00000000-0000-0000-0000-00000000f004', cA, 'libre adulto', 'free', true);
  insert into public.posts (id, creator_id, body, visibility, published_at) values
    ('00000000-0000-0000-0000-00000000f005', cA, 'programado', 'free', now() + interval '1 day');
  perform t.fails($q$insert into public.posts (creator_id, body, published_at) values ((select auth.uid()), 'x', now() + interval '200 days')$q$, '90 días');
  -- no puede publicar a nombre de otro ni auto-ocultar/mostrar
  perform t.fails(format($q$insert into public.posts (creator_id, body) values (%L, 'suplanto')$q$, t.id('cB')));
  perform t.fails($q$update public.posts set is_hidden = true where id = '00000000-0000-0000-0000-00000000f001'$q$, 'No autorizado');
  insert into public.post_media (post_id, creator_id, path, kind)
    values ('00000000-0000-0000-0000-00000000f002', cA, cA || '/00000000-0000-0000-0000-00000000f002/foto.jpg', 'image');
  perform t.fails(format($q$insert into public.post_media (post_id, creator_id, path, kind)
    values ('00000000-0000-0000-0000-00000000f002', %L, 'otra/ruta.jpg', 'image')$q$, cA), 'check');
end $$;
select t.reset();

-- creador B (gratis) y creador suspendible
select t.login('cB');
insert into public.posts (id, creator_id, body, visibility) values
  ('00000000-0000-0000-0000-00000000b001', t.id('cB'), 'solo suscriptores de B', 'subscribers');
select t.reset();
select t.login('cOff');
insert into public.posts (id, creator_id, body, visibility) values
  ('00000000-0000-0000-0000-00000000c001', t.id('cOff'), 'libre de cOff', 'free');
select t.reset();

-- ------------------------------------------------------------ acceso al contenido
select t.anon();
do $$ begin
  perform t.ok((select count(*) from public.get_feed(p_creator => t.id('cA'))) = 4, 'anon: 4 posts (sin el programado)');
  perform t.ok((select count(*) from public.get_feed(p_creator => t.id('cA')) where not locked) = 1, 'anon: solo el libre no adulto');
  perform t.ok((select body from public.get_feed(p_creator => t.id('cA')) where visibility = 'subscribers') is null, 'cuerpo oculto');
  perform t.ok(t.n('select 1 from public.posts') = 2, 'anon: tabla posts solo libres no adultos (cA y cOff)');
  perform t.ok(t.n('select 1 from public.post_media') = 0, 'anon no ve media');
  perform t.ok(t.n('select 1 from public.public_creators') = 3, 'directorio público');
  perform t.fails('select email from public.public_creators');
  perform t.fails($q$insert into public.posts (creator_id, body) values (gen_random_uuid(), 'x')$q$);
end $$;
select t.reset();

select t.login('f1');
do $$ begin
  perform t.ok((select count(*) from public.get_feed(p_creator => t.id('cA')) where not locked) = 2, 'fan sin sub: libre + adulto libre');
  perform t.ok(t.n('select 1 from public.posts where creator_id = t.id(''cA'')') = 2, 'RLS: solo lo permitido');
  -- no puede escribir en tablas de dinero ni de acceso
  perform t.fails(format($q$insert into public.subscriptions (fan_id, creator_id, price_cents, current_period_end)
     values (%L, %L, 0, 'infinity')$q$, t.id('f1'), t.id('cA')));
  perform t.fails(format($q$insert into public.purchases (fan_id, post_id, amount_cents)
     values (%L, '00000000-0000-0000-0000-00000000f003', 1000)$q$, t.id('f1')));
  perform t.fails(format($q$insert into public.transactions (kind, fan_id, creator_id, gross_cents, fee_cents, net_cents, fee_bps, currency, provider, provider_ref)
     values ('tip', %L, %L, 100, 20, 80, 2000, 'MXN', 'x', 'y')$q$, t.id('f1'), t.id('cA')));
  perform t.fails($q$select public.record_refund('mock', 'x')$q$, 'permission denied');
  perform t.fails($q$select public.creator_balance(null) where false; select public.request_payout(1000)$q$);
end $$;
select t.reset();

-- ------------------------------------------------ pagos: suscripción, ppv, propina
select t.service();
do $$
declare v uuid; v2 uuid;
begin
  v := public.record_payment('mock', 'ref_sub1', null, 'subscription', t.id('f1'), t.id('cA'), null, 5000, 'MXN',
                             now() + interval '30 days', 'sub_1', null);
  perform t.ok(v is not null, 'registra suscripción');
  v2 := public.record_payment('mock', 'ref_sub1', null, 'subscription', t.id('f1'), t.id('cA'), null, 5000, 'MXN',
                              now() + interval '30 days', 'sub_1', null);
  perform t.ok(v2 is null, 'idempotente: segundo intento no duplica');
  perform t.fails($q$select public.record_payment('mock','neg',null,'tip',null,null,null,-5,'MXN')$q$, 'Monto');
  perform t.fails($q$select public.record_payment('mock','x',null,'subscription',null,null,null,100,'MXN')$q$, 'periodo');
end $$;
select t.reset();
do $$ begin
  perform t.ok((select fee_cents from public.transactions where provider_ref = 'ref_sub1') = 1000, 'comisión 20%');
  perform t.ok((select net_cents from public.transactions where provider_ref = 'ref_sub1') = 4000, 'neto 80%');
  perform t.ok((select count(*) from public.subscriptions) = 1, 'una suscripción');
end $$;

select t.login('f1');
do $$ begin
  perform t.ok((select count(*) from public.get_feed(p_creator => t.id('cA')) where not locked) = 3, 'suscriptor: libre + adulto + suscriptores');
  perform t.ok((select locked from public.get_feed(p_creator => t.id('cA')) where visibility = 'ppv'), 'ppv sigue bloqueado para suscriptores');
  perform t.ok(t.n('select 1 from public.post_media') = 1, 've la media de suscriptores');
  perform t.ok((select count(*) from public.get_feed(p_home => true)) = 4, 'feed de inicio: posts del creador suscrito');
  perform t.ok(t.n('select 1 from public.my_subscriptions()') = 1, 'mis suscripciones');
end $$;
select t.reset();

select t.login('f2');
do $$ begin
  perform t.ok(t.n('select 1 from public.post_media') = 0, 'sin suscripción no ve media');
  perform t.ok((select count(*) from public.get_feed(p_home => true)) = 0, 'feed de inicio vacío sin suscripciones');
  perform t.ok(t.n('select 1 from public.messages') = 0, 'sin mensajes');
end $$;
select t.reset();

-- almacenamiento: el archivo solo se puede firmar/leer con acceso
insert into storage.objects (bucket_id, name, owner)
values ('media', t.id('cA') || '/00000000-0000-0000-0000-00000000f002/foto.jpg', t.id('cA'));
select t.login('f1');
do $$ begin perform t.ok(t.n('select 1 from storage.objects where bucket_id = ''media''') = 1, 'storage: suscriptor lee'); end $$;
select t.reset();
select t.login('f2');
do $$ begin perform t.ok(t.n('select 1 from storage.objects where bucket_id = ''media''') = 0, 'storage: sin acceso no lee'); end $$;
select t.reset();
select t.anon();
do $$ begin perform t.ok(t.n('select 1 from storage.objects where bucket_id = ''media''') = 0, 'storage: anónimo no lee'); end $$;
select t.reset();
select t.login('cA');
do $$ begin
  perform t.ok(t.n('select 1 from storage.objects where bucket_id = ''media''') = 1, 'storage: el dueño lee');
  insert into storage.objects (bucket_id, name, owner)
    values ('media', t.id('cA') || '/00000000-0000-0000-0000-00000000f002/video.mp4', t.id('cA'));
  perform t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('media', %L, %L)$q$,
                         t.id('cB') || '/x/y.jpg', t.id('cA')));
end $$;
select t.reset();
select t.login('f1');
do $$ begin
  perform t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('media', %L, %L)$q$,
                         t.id('f1') || '/x/y.jpg', t.id('f1')));
end $$;
select t.reset();
select t.login('cB');
do $$ begin
  perform t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('media', %L, %L)$q$,
                         t.id('cA') || '/x/y.jpg', t.id('cB')));
end $$;
select t.reset();

-- ppv + reembolso + propina
select t.service();
do $$ begin
  perform t.ok(public.record_payment('mock', 'pi_ppv1', null, 'ppv', t.id('f1'), t.id('cA'),
               '00000000-0000-0000-0000-00000000f003', 2500, 'MXN') is not null, 'registra ppv');
  perform t.ok(public.record_payment('mock', 'pi_tip1', null, 'tip', t.id('f2'), t.id('cA'), null, 2000, 'MXN', null, null, 'gracias') is not null, 'registra propina');
end $$;
select t.reset();
select t.login('f1');
do $$ begin perform t.ok(not (select locked from public.get_feed(p_creator => t.id('cA')) where visibility = 'ppv'), 'ppv desbloqueado tras pagar'); end $$;
select t.reset();
select t.login('f2');
do $$ begin perform t.ok((select locked from public.get_feed(p_creator => t.id('cA')) where visibility = 'ppv'), 'otro fan sigue bloqueado'); end $$;
select t.reset();
select t.service();
do $$ begin
  perform t.ok(public.record_refund('mock', 'pi_ppv1'), 'reembolso ppv');
  perform t.ok(not public.record_refund('mock', 'pi_ppv1'), 'doble reembolso no hace nada');
end $$;
select t.reset();
select t.login('f1');
do $$ begin perform t.ok((select locked from public.get_feed(p_creator => t.id('cA')) where visibility = 'ppv'), 'ppv se vuelve a bloquear tras el reembolso'); end $$;
select t.reset();

-- ------------------------------------------------------------------ saldo y retiros
select t.login('cA');
do $$
declare b record;
begin
  select * into b from public.creator_balance();
  perform t.ok(b.earned_cents = 5600, 'ganado = 4000 (sub) + 1600 (propina), sin lo reembolsado');
  perform t.ok(b.available_cents = 0 and b.hold_cents = 5600, 'todo en retención al inicio');
  perform t.fails($q$select public.request_payout(5000)$q$, 'cuenta');
  perform t.ok(t.n('select 1 from public.my_earnings()') = 3, 'historial incluye lo reembolsado');
end $$;
select t.reset();
select t.login('f1');
do $$ begin
  perform t.fails($q$select public.request_payout(5000)$q$, 'creadores');
  perform t.ok(t.n('select 1 from public.creator_balance()') = 1 and (select earned_cents from public.creator_balance()) = 0, 'un fan solo ve su propio saldo (0)');
  perform t.ok(t.n(format('select 1 from public.creator_balance(%L)', t.id('cA'))) = 0, 'no ve el saldo ajeno');
end $$;
select t.reset();

update public.transactions set created_at = now() - interval '10 days';
select t.login('admin');
update public.platform_settings set min_payout_cents = 1000;
select t.reset();
select t.login('cA');
do $$
declare b record; pid uuid;
begin
  perform t.ok((select available_cents from public.creator_balance()) = 5600, 'tras la retención queda disponible');
  insert into public.creator_payout_accounts (user_id, holder_name, account_ref, bank_name)
    values (t.id('cA'), 'Persona cA', '012345678901234567', 'Banco X');
  perform t.fails($q$insert into public.creator_payout_accounts (user_id, holder_name, account_ref) values ((select auth.uid()), 'x', '1')$q$);
  perform t.fails($q$select public.request_payout(500)$q$, 'mínimo');
  perform t.fails($q$select public.request_payout(9000)$q$, 'insuficiente');
  pid := public.request_payout(5000);
  perform t.ok(pid is not null, 'retiro solicitado');
  perform t.fails($q$select public.request_payout(1000)$q$);   -- ya hay uno abierto
  select * into b from public.creator_balance();
  perform t.ok(b.pending_payout_cents = 5000 and b.available_cents = 600, 'saldo refleja el retiro pendiente');
end $$;
select t.reset();
select t.login('cB');
do $$ begin
  perform t.ok(t.n('select 1 from public.payouts') = 0, 'cB no ve retiros de otros');
  perform t.ok(t.n('select 1 from public.creator_payout_accounts') = 0, 'cB no ve cuentas de otros');
end $$;
select t.reset();
select t.login('admin');
do $$
declare pid uuid;
begin
  select id into pid from public.payouts where status = 'requested';
  perform t.fails(format('select public.admin_resolve_payout(%L, ''paid'', null)', pid), 'referencia');
  perform public.admin_resolve_payout(pid, 'paid', 'SPEI-123');
  perform t.ok((select paid_out_cents from public.creator_balance(t.id('cA'))) = 5000, 'admin ve saldo y retiro pagado');
  perform t.fails(format('select public.admin_resolve_payout(%L, ''paid'', ''otra'')', pid), 'ya resuelto');
  perform t.ok(t.n('select 1 from public.creator_payout_accounts') = 1, 'admin ve cuentas');
  perform t.ok((public.admin_stats()->>'requested_payouts')::int = 0, 'stats');
end $$;
select t.reset();
select t.login('cA');
do $$
declare n int;
begin
  update public.payouts set status = 'requested', amount_cents = 1 where creator_id = t.id('cA');
  get diagnostics n = row_count;
  perform t.ok(n = 0, 'el creador no puede editar retiros');
end $$;
select t.reset();
select t.login('f1');
do $$ begin perform t.ok(public.admin_stats() is null, 'un fan no obtiene estadísticas'); end $$;
select t.reset();

-- --------------------------------------------------------- likes y comentarios
select t.login('f1');
do $$ begin
  insert into public.likes (post_id, user_id) values ('00000000-0000-0000-0000-00000000f002', t.id('f1'));
  perform t.ok((select like_count from public.get_feed(p_post => '00000000-0000-0000-0000-00000000f002')) = 1, 'like cuenta');
  perform t.ok((select liked from public.get_feed(p_post => '00000000-0000-0000-0000-00000000f002')), 'liked = true');
  insert into public.comments (post_id, user_id, body) values ('00000000-0000-0000-0000-00000000f002', t.id('f1'), 'genial');
  perform t.ok(t.n('select 1 from public.get_comments(''00000000-0000-0000-0000-00000000f002'')') = 1, 've comentarios');
  perform t.fails(format($q$insert into public.comments (post_id, user_id, body) values ('00000000-0000-0000-0000-00000000f002', %L, 'x')$q$, t.id('f2')));
  perform t.fails($q$insert into public.comments (post_id, user_id, body, is_hidden) values ('00000000-0000-0000-0000-00000000f002', (select auth.uid()), 'x', true)$q$);
end $$;
select t.reset();
select t.login('f2');
do $$ begin
  perform t.fails(format($q$insert into public.likes (post_id, user_id) values ('00000000-0000-0000-0000-00000000f002', %L)$q$, t.id('f2')));
  perform t.fails(format($q$insert into public.comments (post_id, user_id, body) values ('00000000-0000-0000-0000-00000000f002', %L, 'cuelo')$q$, t.id('f2')));
  perform t.ok(t.n('select 1 from public.get_comments(''00000000-0000-0000-0000-00000000f002'')') = 0, 'sin acceso no ve comentarios');
end $$;
select t.reset();
select t.login('cA');
do $$
declare n int;
begin
  delete from public.comments where post_id = '00000000-0000-0000-0000-00000000f002';
  get diagnostics n = row_count;
  perform t.ok(n = 1, 'el creador modera comentarios de su post');
end $$;
select t.reset();
-- límite de comentarios
select t.login('f1');
do $$
declare i int; caught boolean := false;
begin
  begin
    for i in 1..25 loop
      insert into public.comments (post_id, user_id, body) values ('00000000-0000-0000-0000-00000000f001', t.id('f1'), 'spam ' || i);
    end loop;
  exception when others then
    caught := sqlerrm like '%Demasiadas%';
  end;
  perform t.ok(caught, 'límite de comentarios por ventana');
end $$;
select t.reset();
delete from public.comments;
delete from public.rate_events;

-- ------------------------------------------------------------ seguir (gratis)
select t.login('f1');
do $$ begin
  perform t.fails(format('select public.follow_creator(%L)', t.id('cA')), 'pago');
  perform public.follow_creator(t.id('cB'));
  perform public.follow_creator(t.id('cB'));   -- idempotente
  perform t.ok((select count(*) from public.subscriptions where creator_id = t.id('cB')) = 1, 'un solo seguimiento');
  perform t.ok((select count(*) from public.get_feed(p_creator => t.id('cB')) where not locked) = 1, 'seguidor ve el post de suscriptores de un creador gratis');
end $$;
select t.reset();
select t.login('cB');
update public.creators set price_cents = 2000 where user_id = t.id('cB');
select t.reset();
select t.login('f1');
do $$ begin
  perform t.ok((select count(*) from public.get_feed(p_creator => t.id('cB')) where not locked) = 0, 'al cobrar, los seguidores gratuitos pierden acceso');
  perform t.fails(format('select public.follow_creator(%L)', t.id('cB')), 'pago');
end $$;
select t.reset();

-- ----------------------------------------------------------------- bloqueos
select t.login('f1');
do $$ begin perform t.fails(format($q$insert into public.blocks (blocker_id, blocked_id) values (%L, %L)$q$, t.id('f1'), t.id('cA'))); end $$;
select t.reset();
select t.login('cA');
insert into public.blocks (blocker_id, blocked_id) values (t.id('cA'), t.id('f1'));
select t.reset();
select t.login('f1');
do $$ begin
  perform t.ok((select count(*) from public.get_feed(p_creator => t.id('cA')) where not locked) = 0, 'bloqueado no ve nada del creador');
  perform t.ok(t.n('select 1 from public.post_media') = 0, 'bloqueado no ve media');
  perform t.fails(format('select public.send_message(%L, ''hola'')', t.id('cA')), 'No puedes');
end $$;
select t.reset();
select t.login('cA');
delete from public.blocks where blocker_id = t.id('cA');
select t.reset();

-- ---------------------------------------------------------------- mensajes
select t.login('f1');
do $$ begin
  perform public.send_message(t.id('cA'), 'hola creadora');
  perform t.fails(format('select public.send_message(%L, '''')', t.id('cA')), 'vac');
  perform t.fails(format('select public.send_message(%L, ''hola'')', t.id('f2')), 'No puedes');
  perform t.ok(t.n('select 1 from public.conversations()') = 1, 'conversación creada');
  perform t.ok((select can_message from public.counterpart(t.id('cA'))), 'counterpart');
end $$;
select t.reset();
select t.login('cA');
do $$ begin
  perform t.ok(public.unread_count() = 1, 'creadora tiene 1 sin leer');
  perform public.send_message(t.id('f1'), 'gracias por suscribirte');
  perform t.fails(format('select public.send_message(%L, ''hola'')', t.id('f2')), 'No puedes');
  perform public.mark_thread_read(t.id('f1'));
  perform t.ok(public.unread_count() = 0, 'marcado como leído');
end $$;
select t.reset();
select t.login('f2');
do $$ begin
  perform t.ok(t.n('select 1 from public.messages') = 0, 'terceros no leen mensajes');
  perform t.ok(t.n('select 1 from public.conversations()') = 0, 'sin conversaciones');
  perform t.fails(format('select public.send_message(%L, ''hola'')', t.id('cA')), 'No puedes');
end $$;
select t.reset();

-- ---------------------------------------------------------------- reportes
select t.login('f1');
do $$ begin
  perform public.report_content('post', '00000000-0000-0000-0000-00000000f002', 'spam', 'molesto');
  perform public.report_content('post', '00000000-0000-0000-0000-00000000f002', 'spam', 'otra vez');   -- duplicado ignorado
  perform t.ok((select count(*) from public.get_feed(p_post => '00000000-0000-0000-0000-00000000f002') where not is_hidden) = 1, 'reporte normal no oculta');
  perform public.report_content('post', '00000000-0000-0000-0000-00000000f001', 'minor', 'sospecho');
  perform t.fails($q$select public.report_content('post', gen_random_uuid(), 'spam')$q$, 'no encontrado');
  perform t.fails($q$select public.report_content('post', '00000000-0000-0000-0000-00000000f001', 'inventado')$q$);
  perform t.ok(t.n('select 1 from public.reports') = 2, 've solo sus reportes');
end $$;
select t.reset();
select t.anon();
do $$ begin
  perform t.ok((select count(*) from public.get_feed(p_creator => t.id('cA')) where id = '00000000-0000-0000-0000-00000000f001') = 0, 'reporte prioritario oculta la publicación');
  perform t.fails($q$select public.report_content('post', '00000000-0000-0000-0000-00000000f002', 'spam')$q$, 'permission denied');
end $$;
select t.reset();
select t.login('f2');
do $$ begin perform t.ok(t.n('select 1 from public.reports') = 0, 'un fan no ve reportes ajenos'); end $$;
select t.reset();
select t.login('admin');
do $$
declare rid uuid;
begin
  perform t.ok((select count(*) from public.admin_reports('open')) = 2, 'admin ve 2 reportes');
  perform t.ok((select priority from public.admin_reports('open') limit 1), 'prioritarios primero');
  select id into rid from public.reports where reason = 'minor';
  perform public.admin_resolve_report(rid, 'dismissed', 'falsa alarma', false);
  perform t.ok((select not is_hidden from public.posts where id = '00000000-0000-0000-0000-00000000f001'), 'descartar restaura una ocultación automática');
end $$;
select t.reset();
select t.login('f2');
do $$ begin
  perform public.report_content('post', '00000000-0000-0000-0000-00000000f001', 'illegal', 'x');
end $$;
select t.reset();
select t.login('admin');
do $$
declare rid uuid;
begin
  select id into rid from public.reports where reporter_id = t.id('f2');
  perform public.admin_resolve_report(rid, 'actioned', 'retirada por política', true);
  perform t.ok((select is_hidden from public.posts where id = '00000000-0000-0000-0000-00000000f001'), 'moderación oculta');
end $$;
select t.reset();
select t.login('cA');
do $$ begin
  perform t.fails($q$update public.posts set is_hidden = false where id = '00000000-0000-0000-0000-00000000f001'$q$, 'No autorizado');
end $$;
select t.reset();
select t.login('admin');
select public.admin_moderate_post('00000000-0000-0000-0000-00000000f001', false);
select t.reset();

-- ------------------------------------------------- suspensión y bloqueo de cuentas
select t.login('f1');
do $$ begin perform t.fails(format('select public.admin_set_creator_status(%L, ''suspended'')', t.id('cOff')), 'Solo administradores'); end $$;
select t.reset();
select t.login('admin');
select public.admin_set_creator_status(t.id('cOff'), 'suspended', 'violación de políticas');
select t.reset();
select t.anon();
do $$ begin
  perform t.ok(t.n('select 1 from public.public_creators') = 2, 'el creador suspendido sale del directorio');
  perform t.ok(t.n(format('select 1 from public.posts where creator_id = %L', t.id('cOff'))) = 0, 'sus publicaciones dejan de ser visibles');
end $$;
select t.reset();
select t.login('cOff');
do $$ begin perform t.fails($q$insert into public.posts (creator_id, body) values ((select auth.uid()), 'sigo publicando')$q$); end $$;
select t.reset();
select t.login('admin');
select public.admin_set_creator_status(t.id('cOff'), 'active');
select public.admin_set_user_active(t.id('f2'), false, 'abuso');
select t.reset();
select t.login('f2');
do $$ begin
  perform t.ok(not public.me_adult(), 'cuenta deshabilitada ya no cuenta como adulta');
  perform t.fails(format('select public.follow_creator(%L)', t.id('cA')));
end $$;
select t.reset();
select t.login('admin');
select public.admin_set_user_active(t.id('f2'), true);
select t.reset();

-- --------------------------------------------- vencimiento de suscripciones
update public.subscriptions set current_period_end = now() - interval '1 day' where fan_id = t.id('f1') and creator_id = t.id('cA');
select t.login('f1');
do $$ begin perform t.ok((select count(*) from public.get_feed(p_creator => t.id('cA')) where visibility = 'subscribers' and not locked) = 0, 'suscripción vencida: sin acceso'); end $$;
select t.reset();
update public.subscriptions set status = 'canceled', cancel_at_period_end = true, current_period_end = now() + interval '5 days'
  where fan_id = t.id('f1') and creator_id = t.id('cA');
select t.login('f1');
do $$ begin perform t.ok((select count(*) from public.get_feed(p_creator => t.id('cA')) where visibility = 'subscribers' and not locked) = 1, 'cancelada pero pagada: conserva acceso hasta el fin del periodo'); end $$;
select t.reset();
select t.login('cA');
do $$ begin perform t.ok(t.n('select 1 from public.my_subscribers()') = 1, 'el creador lista sus suscriptores'); end $$;
select t.reset();
select t.login('f1');
do $$ begin perform t.ok(t.n('select 1 from public.my_subscribers()') = 0, 'un fan no lista suscriptores'); end $$;
select t.reset();
update public.subscriptions set current_period_end = now() - interval '4 days' where fan_id = t.id('f1') and creator_id = t.id('cA');
select t.service();
do $$ begin perform t.ok(public.expire_subscriptions() >= 1, 'expire_subscriptions'); end $$;
select t.reset();

-- ------------------------------------------------------ KYC, huérfanos, RLS global
insert into storage.objects (bucket_id, name, owner) values ('kyc', t.id('cA') || '/id.jpg', t.id('cA'));
select t.login('admin');
do $$ begin perform t.ok(t.n('select 1 from storage.objects where bucket_id = ''kyc''') = 1, 'el admin lee documentos KYC'); end $$;
select t.reset();
select t.login('cA');
do $$ begin
  perform t.ok(t.n('select 1 from storage.objects where bucket_id = ''kyc''') = 0, 'ni el dueño relee su KYC');
  insert into storage.objects (bucket_id, name, owner) values ('kyc', t.id('cA') || '/extra.jpg', t.id('cA'));
  perform t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('kyc', %L, %L)$q$, t.id('cB') || '/x.jpg', t.id('cA')));
end $$;
select t.reset();
select t.login('f1');
do $$ begin perform t.ok(t.n('select 1 from storage.objects where bucket_id = ''kyc''') = 0, 'otros no leen KYC'); end $$;
select t.reset();

insert into storage.objects (bucket_id, name, created_at) values ('media', 'x/y/huerfano.jpg', now() - interval '3 days');
select t.service();
do $$ begin
  perform t.ok(t.n('select 1 from public.orphan_media_paths(24)') >= 1, 'detecta archivos huérfanos');
  perform t.ok(t.n('select 1 from public.tables_without_rls()') = 0, 'todas las tablas tienen RLS');
  perform t.ok(t.n('select 1 from public.kyc_to_purge(30)') = 0, 'KYC reciente no se purga');
end $$;
select t.reset();
select t.login('f1');
do $$ begin
  perform t.fails($q$select * from public.orphan_media_paths(1)$q$, 'permission denied');
  perform t.fails($q$select * from public.tables_without_rls()$q$, 'permission denied');
  perform t.fails($q$select public.cleanup_old_audit(1)$q$, 'permission denied');
end $$;
select t.reset();
update public.creator_applications set reviewed_at = now() - interval '40 days' where status = 'approved';
select t.service();
do $$
declare ids uuid[];
begin
  perform t.ok(t.n('select 1 from public.kyc_to_purge(30)') = 3, 'KYC antiguo listo para purgar');
  select array_agg(app_id) into ids from public.kyc_to_purge(30);
  perform public.mark_kyc_purged(ids);
  perform t.ok(t.n('select 1 from public.kyc_to_purge(30)') = 0, 'ya purgado');
end $$;
select t.reset();

-- --------------------------------------------------------- último administrador
do $$ begin
  perform t.fails(format($q$update public.profiles set role = 'fan' where id = %L$q$, t.id('admin')), 'último administrador');
  perform t.fails(format($q$update public.profiles set is_active = false where id = %L$q$, t.id('admin')), 'último administrador');
end $$;

-- --------------------------------------------------------------------- limpieza
delete from public.transactions;
delete from storage.objects;
delete from auth.users where id in (select id from t.ids);
drop schema t cascade;
\echo '== TODAS LAS PRUEBAS DE SEGURIDAD PASARON =='
