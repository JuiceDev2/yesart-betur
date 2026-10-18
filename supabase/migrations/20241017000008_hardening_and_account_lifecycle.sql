-- =============================================================================
-- 008: endurecimiento + ciclo de vida de cuentas
--  1. Bootstrap del primer admin (el trigger bloqueaba incluso al SQL editor)
--  2. Eliminar versiones viejas de create_order
--  3. orders.artist_id sobrevive al borrado del artista (on delete set null)
--  4. Funciones admin atómicas: deshabilitar/habilitar artista, solicitudes
--  5. Vista de auditoría legible y paginación eficiente
--  6. Impedir que una cuenta de artista cambie su propio rol vía función
-- (No edites migraciones anteriores: ya pueden estar aplicadas.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. protect_profile_columns: permitir contexto de servidor / SQL editor
--    Un cliente que llega por la API siempre trae un JWT con rol 'anon' o
--    'authenticated', así que auth.role() NUNCA es nulo para él.
--    En el SQL editor (postgres) auth.role() es nulo, y con la service role
--    es 'service_role'. Solo esos dos contextos pasan sin ser admin.
-- -----------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if auth.uid() is null and (auth.role() is null or auth.role() = 'service_role') then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email then
    raise exception 'No autorizado a modificar role, is_active o email';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Limpiar overloads viejos de create_order (ya estaban revocados)
-- -----------------------------------------------------------------------------
drop function if exists public.create_order(text, text, uuid, uuid, text);
drop function if exists public.create_order(text, text, uuid, uuid, text, text);

-- -----------------------------------------------------------------------------
-- 3. orders.artist_id: no bloquear el borrado de un artista con órdenes
-- -----------------------------------------------------------------------------
alter table public.orders alter column artist_id drop not null;

do $$
declare
  v_con text;
begin
  select c.conname into v_con
  from pg_constraint c
  where c.conrelid = 'public.orders'::regclass
    and c.contype = 'f'
    and c.confrelid = 'public.profiles'::regclass
    and exists (
      select 1 from unnest(c.conkey) k
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
      where a.attname = 'artist_id'
    );
  if v_con is not null then
    execute format('alter table public.orders drop constraint %I', v_con);
  end if;
end $$;

alter table public.orders
  add constraint orders_artist_id_fkey
  foreign key (artist_id) references public.profiles(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 4a. Habilitar / deshabilitar artista (admin) con motivo y auditoría atómica
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_artist_active(
  p_artist_id uuid,
  p_active boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo administradores';
  end if;

  update public.profiles
  set is_active = p_active,
      updated_at = now()
  where id = p_artist_id
    and role = 'artist';

  if not found then
    raise exception 'Artista no encontrado';
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (
    auth.uid(),
    case when p_active then 'enable_artist' else 'disable_artist' end,
    'profile',
    p_artist_id::text,
    jsonb_build_object('reason', nullif(left(trim(coalesce(p_reason, '')), 500), ''))
  );
end;
$$;

revoke all on function public.admin_set_artist_active(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_artist_active(uuid, boolean, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4b. Rechazo con motivo (se guarda en la solicitud)
-- -----------------------------------------------------------------------------
alter table public.artist_applications
  add column if not exists review_note text check (char_length(review_note) <= 500);

create or replace function public.reject_artist_application(
  app_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo administradores';
  end if;

  update public.artist_applications
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = nullif(left(trim(coalesce(p_reason, '')), 500), '')
  where id = app_id and status = 'pending';

  if not found then
    raise exception 'Solicitud no encontrada o ya procesada';
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (
    auth.uid(), 'reject_artist', 'application', app_id::text,
    jsonb_build_object('reason', nullif(left(trim(coalesce(p_reason, '')), 500), ''))
  );
end;
$$;

-- La versión de un solo parámetro (migración 003) queda sustituida por la nueva.
drop function if exists public.reject_artist_application(uuid);

revoke all on function public.reject_artist_application(uuid, text) from public, anon;
grant execute on function public.reject_artist_application(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Índices para búsqueda/paginación del panel admin
-- -----------------------------------------------------------------------------
create index if not exists audit_log_created_idx
  on public.audit_log (created_at desc);

create index if not exists profiles_role_created_idx
  on public.profiles (role, created_at desc);

-- -----------------------------------------------------------------------------
-- 6. El admin no puede quedarse sin administradores por accidente
--    (impide degradar/desactivar al último admin activo)
-- -----------------------------------------------------------------------------
create or replace function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining int;
begin
  if old.role = 'admin' and old.is_active = true
     and (new.role <> 'admin' or new.is_active = false) then
    select count(*) into v_remaining
    from public.profiles
    where role = 'admin' and is_active = true and id <> old.id;
    if v_remaining = 0 then
      raise exception 'No se puede quitar al último administrador activo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_last_admin on public.profiles;
create trigger profiles_protect_last_admin
  before update on public.profiles
  for each row execute function public.protect_last_admin();
