-- =============================================================================
-- Fixes: public artists, order auth, applications, rate limit
-- =============================================================================

-- 1. public_artists: security_barrier view WITHOUT security_invoker
--    so it runs with owner privileges and can read profiles for active artists
drop view if exists public.public_artists;

create view public.public_artists
with (security_barrier = true)
as
select
  id,
  full_name,
  avatar_url,
  bio,
  created_at
from public.profiles
where role = 'artist'
  and is_active = true;

-- Allow anon/authenticated to SELECT the view
grant select on public.public_artists to anon, authenticated;

-- Helper: get public artist by id (security definer)
create or replace function public.get_public_artist(p_id uuid)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.avatar_url, p.bio, p.created_at
  from public.profiles p
  where p.id = p_id
    and p.role = 'artist'
    and p.is_active = true;
$$;

grant execute on function public.get_public_artist(uuid) to anon, authenticated;

-- 2. Fix update_order_status: require auth, use IS DISTINCT FROM
create or replace function public.update_order_status(
  p_order_id uuid,
  p_new_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order is null then
    raise exception 'Orden no encontrada';
  end if;

  -- Artist owner or admin
  if v_order.artist_id is not distinct from v_uid or public.is_admin() then
    if not (
      (v_order.status = 'pending' and p_new_status in ('contacted', 'cancelled'))
      or (v_order.status = 'contacted' and p_new_status in ('completed', 'cancelled'))
    ) then
      raise exception 'Transición de estado no permitida';
    end if;
    update public.orders set status = p_new_status where id = p_order_id;
    return;
  end if;

  -- Client can only cancel own pending order
  if v_order.client_user_id is not distinct from v_uid
     and v_order.status = 'pending'
     and p_new_status = 'cancelled' then
    update public.orders set status = 'cancelled' where id = p_order_id;
    return;
  end if;

  raise exception 'No autorizado';
end;
$$;

-- Revoke from anon; only authenticated
revoke all on function public.update_order_status(uuid, text) from anon, public;
grant execute on function public.update_order_status(uuid, text) to authenticated;

-- 3. artist_applications: drop bad unique, fix insert policy
alter table public.artist_applications
  drop constraint if exists artist_applications_user_id_status_key;

-- One pending application per user
create unique index if not exists artist_applications_one_pending
  on public.artist_applications (user_id)
  where status = 'pending';

-- Replace insert policy: force status = pending, only own user
drop policy if exists "applications_insert" on public.artist_applications;
create policy "applications_insert"
  on public.artist_applications for insert
  with check (
    auth.uid() = user_id
    and status = 'pending'
  );

-- 4. Rate limit also by user id when logged in
create table if not exists public.order_rate_limits_user (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists order_rate_limits_user_idx
  on public.order_rate_limits_user (user_id, created_at desc);

alter table public.order_rate_limits_user enable row level security;
drop policy if exists "rate_limits_user_deny" on public.order_rate_limits_user;
create policy "rate_limits_user_deny"
  on public.order_rate_limits_user for all using (false);

-- Recreate create_order with phone + user rate limits
create or replace function public.create_order(
  p_client_name text,
  p_client_phone text,
  p_artwork_id uuid default null,
  p_service_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artist_id uuid;
  v_order_id uuid;
  v_count int;
  v_uid uuid := auth.uid();
  v_name text := left(trim(p_client_name), 120);
  v_phone text := left(trim(p_client_phone), 30);
  v_notes text := left(trim(coalesce(p_notes, '')), 1000);
begin
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Nombre inválido';
  end if;
  if v_phone is null or char_length(v_phone) < 7 then
    raise exception 'Teléfono inválido';
  end if;
  if (p_artwork_id is null and p_service_id is null)
     or (p_artwork_id is not null and p_service_id is not null) then
    raise exception 'Debe indicar exactamente un ítem (obra o servicio)';
  end if;

  -- Rate limit by phone: max 5 / hour
  select count(*) into v_count
  from public.order_rate_limits
  where phone = v_phone
    and created_at > now() - interval '1 hour';
  if v_count >= 5 then
    raise exception 'Demasiadas solicitudes. Intenta más tarde.';
  end if;

  -- Rate limit by user when logged in: max 10 / hour
  if v_uid is not null then
    select count(*) into v_count
    from public.order_rate_limits_user
    where user_id = v_uid
      and created_at > now() - interval '1 hour';
    if v_count >= 10 then
      raise exception 'Demasiadas solicitudes. Intenta más tarde.';
    end if;
  end if;

  if p_artwork_id is not null then
    select a.artist_id into v_artist_id
    from public.artworks a
    where a.id = p_artwork_id
      and a.status = 'available'
      and a.is_hidden = false
      and public.is_active_artist(a.artist_id);
    if v_artist_id is null then
      raise exception 'Obra no disponible';
    end if;
  else
    select s.artist_id into v_artist_id
    from public.services s
    where s.id = p_service_id
      and s.is_active = true
      and s.is_hidden = false
      and public.is_active_artist(s.artist_id);
    if v_artist_id is null then
      raise exception 'Servicio no disponible';
    end if;
  end if;

  insert into public.orders (
    client_name, client_phone, client_user_id,
    artwork_id, service_id, artist_id, notes, status
  ) values (
    v_name, v_phone, v_uid,
    p_artwork_id, p_service_id, v_artist_id,
    nullif(v_notes, ''), 'pending'
  ) returning id into v_order_id;

  insert into public.order_rate_limits (phone) values (v_phone);
  if v_uid is not null then
    insert into public.order_rate_limits_user (user_id) values (v_uid);
  end if;

  return v_order_id;
end;
$$;

-- 5. Audit helper
create or replace function public.write_audit(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_meta jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_meta);
end;
$$;

grant execute on function public.write_audit(text, text, text, jsonb) to authenticated;

-- Wrap approve/reject to write audit
create or replace function public.approve_artist_application(app_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo administradores';
  end if;

  select user_id into v_user_id
  from public.artist_applications
  where id = app_id and status = 'pending';

  if v_user_id is null then
    raise exception 'Solicitud no encontrada o ya procesada';
  end if;

  update public.artist_applications
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = app_id;

  update public.profiles
  set role = 'artist',
      is_active = true,
      updated_at = now()
  where id = v_user_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), 'approve_artist', 'application', app_id::text,
          jsonb_build_object('user_id', v_user_id));
end;
$$;

create or replace function public.reject_artist_application(app_id uuid)
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
      reviewed_at = now()
  where id = app_id and status = 'pending';

  if not found then
    raise exception 'Solicitud no encontrada o ya procesada';
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (auth.uid(), 'reject_artist', 'application', app_id::text);
end;
$$;
