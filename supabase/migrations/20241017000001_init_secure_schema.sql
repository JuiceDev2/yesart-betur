-- =============================================================================
-- Yesart-betur — Schema seguro (Fase 1)
-- Idempotente donde es posible. Ejecutar en orden.
-- =============================================================================

-- Extensiones
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1.1 Helpers: is_admin / is_active_artist (security definer, search_path fijo)
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
  );
$$;

create or replace function public.is_active_artist(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'artist'
      and p.is_active = true
  );
$$;

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 30),
  role text not null default 'client'
    check (role in ('admin', 'artist', 'client')),
  bio text check (char_length(bio) <= 1000),
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_unique
  on public.profiles (lower(email)) where email is not null;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Protect sensitive columns (role, is_active, email)
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
  -- Non-admins cannot change role, is_active, or email
  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email then
    raise exception 'No autorizado a modificar role, is_active o email';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- handle_new_user: ALWAYS client, ignore metadata role (C1 fix)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role, is_active)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
    left(coalesce(new.raw_user_meta_data->>'phone', ''), 30),
    'client',  -- NEVER trust client-supplied role
    true
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Artist applications (Fase 1.2)
-- -----------------------------------------------------------------------------
create table if not exists public.artist_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_url text,
  message text check (char_length(message) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, status) -- one pending at a time handled in app; soft constraint
);

create index if not exists artist_applications_status_idx
  on public.artist_applications (status, created_at desc);

-- Approve artist (security definer, admin only)
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

  -- Bypass protect trigger via security definer update
  update public.profiles
  set role = 'artist',
      is_active = true,
      updated_at = now()
  where id = v_user_id;
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
end;
$$;

-- -----------------------------------------------------------------------------
-- Artworks
-- -----------------------------------------------------------------------------
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 150),
  description text check (char_length(description) <= 3000),
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  category text check (char_length(category) <= 80),
  status text not null default 'available'
    check (status in ('available', 'sold', 'reserved')),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artworks_status_created_idx
  on public.artworks (status, created_at desc);
create index if not exists artworks_artist_idx
  on public.artworks (artist_id);

drop trigger if exists artworks_set_updated_at on public.artworks;
create trigger artworks_set_updated_at
  before update on public.artworks
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Services
-- -----------------------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 150),
  description text check (char_length(description) <= 3000),
  price_per_hour numeric(10,2) not null check (price_per_hour >= 0),
  image_url text,
  is_active boolean not null default true,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists services_active_created_idx
  on public.services (is_active, created_at desc);
create index if not exists services_artist_idx
  on public.services (artist_id);

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Orders (artwork_id XOR service_id, client_user_id)
-- -----------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(client_name) between 2 and 120),
  client_phone text not null check (char_length(client_phone) between 7 and 30),
  client_user_id uuid references auth.users on delete set null,
  artwork_id uuid references public.artworks(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  artist_id uuid not null references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'contacted', 'completed', 'cancelled')),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_exactly_one_item check (
    (artwork_id is not null and service_id is null)
    or (artwork_id is null and service_id is not null)
  )
);

create index if not exists orders_artist_status_idx
  on public.orders (artist_id, status, created_at desc);
create index if not exists orders_client_user_idx
  on public.orders (client_user_id);
create index if not exists orders_phone_created_idx
  on public.orders (client_phone, created_at desc);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Rate-limit helper table
create table if not exists public.order_rate_limits (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_rate_limits_phone_idx
  on public.order_rate_limits (phone, created_at desc);

-- create_order RPC (security definer)
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

  -- Rate limit: max 5 orders per phone per hour
  select count(*) into v_count
  from public.order_rate_limits
  where phone = v_phone
    and created_at > now() - interval '1 hour';
  if v_count >= 5 then
    raise exception 'Demasiadas solicitudes. Intenta más tarde.';
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
    v_name, v_phone, auth.uid(),
    p_artwork_id, p_service_id, v_artist_id,
    nullif(v_notes, ''), 'pending'
  ) returning id into v_order_id;

  insert into public.order_rate_limits (phone) values (v_phone);

  return v_order_id;
end;
$$;

-- Order status machine for artists
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
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order is null then
    raise exception 'Orden no encontrada';
  end if;

  -- Artist owner or admin
  if v_order.artist_id <> auth.uid() and not public.is_admin() then
    -- Client can only cancel pending
    if v_order.client_user_id = auth.uid()
       and v_order.status = 'pending'
       and p_new_status = 'cancelled' then
      update public.orders set status = 'cancelled' where id = p_order_id;
      return;
    end if;
    raise exception 'No autorizado';
  end if;

  -- Allowed transitions
  if not (
    (v_order.status = 'pending' and p_new_status in ('contacted', 'cancelled'))
    or (v_order.status = 'contacted' and p_new_status in ('completed', 'cancelled'))
  ) then
    raise exception 'Transición de estado no permitida';
  end if;

  update public.orders set status = p_new_status where id = p_order_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Audit log
-- -----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_type text,
  target_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Public artists view (no email/phone)
-- -----------------------------------------------------------------------------
create or replace view public.public_artists
with (security_invoker = true)
as
select id, full_name, avatar_url, bio, created_at
from public.profiles
where role = 'artist' and is_active = true;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.artworks enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.artist_applications enable row level security;
alter table public.audit_log enable row level security;
alter table public.order_rate_limits enable row level security;

-- Drop old permissive policies if re-running
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','artworks','services','orders','artist_applications','audit_log','order_rate_limits')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Profiles: own row full, admin full, public only via view
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- Artworks: public read only active artist + not hidden
create policy "artworks_select_public"
  on public.artworks for select
  using (
    (is_hidden = false and public.is_active_artist(artist_id))
    or auth.uid() = artist_id
    or public.is_admin()
  );

create policy "artworks_insert_artist"
  on public.artworks for insert
  with check (auth.uid() = artist_id and public.is_active_artist(auth.uid()));

create policy "artworks_update_artist"
  on public.artworks for update
  using (auth.uid() = artist_id and public.is_active_artist(auth.uid()))
  with check (auth.uid() = artist_id and public.is_active_artist(auth.uid()));

create policy "artworks_delete_artist"
  on public.artworks for delete
  using (auth.uid() = artist_id and public.is_active_artist(auth.uid()));

create policy "artworks_admin_all"
  on public.artworks for all
  using (public.is_admin())
  with check (public.is_admin());

-- Services
create policy "services_select_public"
  on public.services for select
  using (
    (is_hidden = false and is_active = true and public.is_active_artist(artist_id))
    or auth.uid() = artist_id
    or public.is_admin()
  );

create policy "services_insert_artist"
  on public.services for insert
  with check (auth.uid() = artist_id and public.is_active_artist(auth.uid()));

create policy "services_update_artist"
  on public.services for update
  using (auth.uid() = artist_id and public.is_active_artist(auth.uid()))
  with check (auth.uid() = artist_id and public.is_active_artist(auth.uid()));

create policy "services_delete_artist"
  on public.services for delete
  using (auth.uid() = artist_id and public.is_active_artist(auth.uid()));

create policy "services_admin_all"
  on public.services for all
  using (public.is_admin())
  with check (public.is_admin());

-- Orders: no direct insert (use RPC). Select for owner/admin/client
create policy "orders_select"
  on public.orders for select
  using (
    auth.uid() = artist_id
    or auth.uid() = client_user_id
    or public.is_admin()
  );

-- No insert policy → only security definer RPC can insert
-- Updates only via update_order_status RPC for status machine

-- Artist applications
create policy "applications_select"
  on public.artist_applications for select
  using (auth.uid() = user_id or public.is_admin());

create policy "applications_insert"
  on public.artist_applications for insert
  with check (auth.uid() = user_id);

create policy "applications_admin"
  on public.artist_applications for all
  using (public.is_admin())
  with check (public.is_admin());

-- Audit: admin only
create policy "audit_admin"
  on public.audit_log for all
  using (public.is_admin())
  with check (public.is_admin());

-- Rate limits: no client access
create policy "rate_limits_deny"
  on public.order_rate_limits for all
  using (false);

-- -----------------------------------------------------------------------------
-- Storage policies notes (run in Dashboard or via storage API):
-- Bucket: artworks, public, 5MB, mime: image/jpeg,image/png,image/webp,image/avif
-- Policy write: (storage.foldername(name))[1] = auth.uid()::text AND is_active_artist
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on public.public_artists to anon, authenticated;
grant execute on function public.create_order to anon, authenticated;
grant execute on function public.update_order_status to authenticated;
grant execute on function public.approve_artist_application to authenticated;
grant execute on function public.reject_artist_application to authenticated;
grant execute on function public.is_admin to authenticated;
grant execute on function public.is_active_artist to authenticated;
