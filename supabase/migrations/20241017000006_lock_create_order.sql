-- =============================================================================
-- 006: create_order solo vía service role (servidor). Cierra bypass público.
-- =============================================================================

-- Revoke ALL public access to every create_order overload
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_order'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- Server-only create_order: p_user_id and p_ip come from trusted server code
create or replace function public.create_order(
  p_client_name text,
  p_client_phone text,
  p_artwork_id uuid default null,
  p_service_id uuid default null,
  p_notes text default null,
  p_ip text default null,
  p_user_id uuid default null
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
  v_name text := left(trim(p_client_name), 120);
  v_phone text := left(trim(p_client_phone), 30);
  v_notes text := left(trim(coalesce(p_notes, '')), 1000);
  v_ip text := left(trim(coalesce(p_ip, '')), 45);
  v_uid uuid := p_user_id;
begin
  -- Only callable with service role (JWT role = service_role)
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;

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

  select count(*) into v_count
  from public.order_rate_limits
  where phone = v_phone and created_at > now() - interval '1 hour';
  if v_count >= 5 then
    raise exception 'Demasiadas solicitudes. Intenta más tarde.';
  end if;

  if v_uid is not null then
    select count(*) into v_count
    from public.order_rate_limits_user
    where user_id = v_uid and created_at > now() - interval '1 hour';
    if v_count >= 10 then
      raise exception 'Demasiadas solicitudes. Intenta más tarde.';
    end if;
  end if;

  if v_ip is not null and char_length(v_ip) >= 3 then
    select count(*) into v_count
    from public.order_rate_limits_ip
    where ip = v_ip and created_at > now() - interval '1 hour';
    if v_count >= 8 then
      raise exception 'Demasiadas solicitudes desde esta red. Intenta más tarde.';
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
  if v_ip is not null and char_length(v_ip) >= 3 then
    insert into public.order_rate_limits_ip (ip) values (v_ip);
  end if;

  return v_order_id;
end;
$$;

-- Explicitly no grants to anon/authenticated
revoke all on function public.create_order(text, text, uuid, uuid, text, text, uuid) from public, anon, authenticated;

-- Cleanup job helper (call from cron / pg_cron if available)
create or replace function public.cleanup_rate_limits()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.order_rate_limits where created_at < now() - interval '48 hours';
  delete from public.order_rate_limits_user where created_at < now() - interval '48 hours';
  delete from public.order_rate_limits_ip where created_at < now() - interval '48 hours';
end;
$$;

revoke all on function public.cleanup_rate_limits() from public, anon, authenticated;
