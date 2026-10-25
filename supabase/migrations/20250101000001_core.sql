-- =============================================================================
-- Aura — 001 núcleo: perfiles, creadores, solicitudes (KYC), auditoría, límites
-- Plataforma de suscripciones para creadores. Ejecutar las migraciones EN ORDEN.
-- =============================================================================
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_reserved_username(u text)
returns boolean language sql immutable set search_path = '' as $$
  select lower(u) = any (array[
    'admin','administrator','root','support','soporte','help','ayuda','aura','api','www',
    'c','explore','explorar','feed','studio','login','register','registro','settings',
    'messages','mensajes','post','posts','terms','privacy','legal','account','null',
    'undefined','moderator','moderacion','staff','official','oficial'
  ]);
$$;

create or replace function public.safe_uuid(p text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- "Bandera interna": las funciones de este esquema la activan SOLO dentro de su
-- transacción para poder tocar columnas protegidas. Un cliente de la API no puede
-- establecer parámetros de sesión arbitrarios.
create or replace function public.internal_flag()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(current_setting('app.internal', true), '') = '1';
$$;

-- -----------------------------------------------------------------------------
-- Perfiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  username text not null,
  display_name text not null default '' check (char_length(display_name) <= 60),
  bio text check (char_length(bio) <= 1000),
  avatar_url text,
  banner_url text,
  role text not null default 'fan' check (role in ('admin', 'creator', 'fan')),
  is_active boolean not null default true,
  age_confirmed_at timestamptz,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_username_reserved check (not public.is_reserved_username(username))
);

create unique index profiles_username_unique on public.profiles (username);
create unique index profiles_email_unique on public.profiles (lower(email)) where email is not null;
create index profiles_role_created_idx on public.profiles (role, created_at desc);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Helpers de identidad. Los que reciben un uuid cualquiera son INTERNOS (se revocan
-- a anon/authenticated al final) para que nadie pueda sondear cuentas ajenas.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.is_active
  );
$$;

create or replace function public.me_adult()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.age_confirmed_at is not null
  );
$$;

create or replace function public.is_adult_user(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.is_active and p.age_confirmed_at is not null
  );
$$;

-- Columnas protegidas del perfil
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() or public.internal_flag() then
    return new;
  end if;
  -- SQL editor (auth.role() nulo) o service role: contextos de servidor
  if auth.uid() is null and (auth.role() is null or auth.role() = 'service_role') then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email
     or new.age_confirmed_at is distinct from old.age_confirmed_at
     or new.terms_accepted_at is distinct from old.terms_accepted_at then
    raise exception 'No autorizado a modificar role, is_active, email o verificación de edad';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Nunca dejar la plataforma sin administradores activos
create or replace function public.protect_last_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_remaining int;
begin
  if old.role = 'admin' and old.is_active
     and (new.role <> 'admin' or not new.is_active) then
    select count(*) into v_remaining from public.profiles
    where role = 'admin' and is_active and id <> old.id;
    if v_remaining = 0 then
      raise exception 'No se puede quitar al último administrador activo';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_last_admin
  before update on public.profiles
  for each row execute function public.protect_last_admin();

-- Alta de perfil al registrarse: SIEMPRE fan, ignora cualquier rol del cliente.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_user text := lower(coalesce(v_meta->>'username', ''));
  v_fallback text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
  v_name text := left(trim(coalesce(v_meta->>'display_name', v_meta->>'full_name', '')), 60);
  v_age timestamptz := case when v_meta->>'age_confirmed' = 'true' then now() end;
  v_terms timestamptz := case when v_meta->>'terms_accepted' = 'true' then now() end;
begin
  if v_user !~ '^[a-z0-9_]{3,24}$'
     or public.is_reserved_username(v_user)
     or exists (select 1 from public.profiles where username = v_user) then
    v_user := v_fallback;
  end if;
  if v_name = '' then
    v_name := left(split_part(coalesce(new.email, ''), '@', 1), 60);
  end if;

  begin
    insert into public.profiles (id, email, username, display_name, role, is_active, age_confirmed_at, terms_accepted_at)
    values (new.id, new.email, v_user, v_name, 'fan', true, v_age, v_terms);
  exception when unique_violation then
    insert into public.profiles (id, email, username, display_name, role, is_active, age_confirmed_at, terms_accepted_at)
    values (new.id, new.email, v_fallback, v_name, 'fan', true, v_age, v_terms);
  end;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Confirmación de mayoría de edad para cuentas que no la hicieron al registrarse
create or replace function public.confirm_adult()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  perform set_config('app.internal', '1', true);
  update public.profiles
    set age_confirmed_at = coalesce(age_confirmed_at, now()),
        terms_accepted_at = coalesce(terms_accepted_at, now())
  where id = auth.uid();
  perform set_config('app.internal', '0', true);
end;
$$;

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- Ajustes de la plataforma (una sola fila)
-- -----------------------------------------------------------------------------
create table public.platform_settings (
  id boolean primary key default true check (id),
  fee_bps int not null default 2000 check (fee_bps between 0 and 5000),
  hold_days int not null default 7 check (hold_days between 0 and 60),
  min_payout_cents int not null default 50000 check (min_payout_cents >= 0),
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings default values;

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;
create policy settings_select on public.platform_settings for select using (true);
create policy settings_update on public.platform_settings for update
  using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Creadores (existen solo tras aprobar una solicitud)
-- -----------------------------------------------------------------------------
create table public.creators (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  price_cents int not null default 0
    check (price_cents = 0 or price_cents between 1000 and 500000),
  category text check (category is null or category in
    ('arte','musica','fitness','cocina','gaming','moda','educacion','estilo-de-vida','adultos','otros')),
  is_nsfw boolean not null default false,
  welcome_message text check (char_length(welcome_message) <= 500),
  status text not null default 'active' check (status in ('active', 'suspended')),
  suspended_reason text check (char_length(suspended_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger creators_set_updated_at
  before update on public.creators
  for each row execute function public.set_updated_at();

create or replace function public.is_active_creator(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.creators c
    join public.profiles p on p.id = c.user_id
    where c.user_id = uid and c.status = 'active' and p.is_active and p.role = 'creator'
  );
$$;

create or replace function public.me_creator()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_creator(auth.uid());
$$;

create or replace function public.creators_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() or public.internal_flag()
     or (auth.uid() is null and (auth.role() is null or auth.role() = 'service_role')) then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
     or new.status is distinct from old.status
     or new.suspended_reason is distinct from old.suspended_reason then
    raise exception 'No autorizado a modificar el estado del creador';
  end if;
  return new;
end;
$$;

create trigger creators_guard_trg
  before update on public.creators
  for each row execute function public.creators_guard();

alter table public.creators enable row level security;
create policy creators_select on public.creators for select
  using (user_id = auth.uid() or public.is_admin());
create policy creators_update on public.creators for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Cuenta para recibir pagos (visible solo para el creador y administradores)
create table public.creator_payout_accounts (
  user_id uuid primary key references public.creators(user_id) on delete cascade,
  holder_name text not null check (char_length(holder_name) between 2 and 120),
  account_ref text not null check (account_ref ~ '^[A-Za-z0-9]{8,34}$'),
  bank_name text check (char_length(bank_name) <= 80),
  updated_at timestamptz not null default now()
);
create trigger payout_accounts_set_updated_at
  before update on public.creator_payout_accounts
  for each row execute function public.set_updated_at();

alter table public.creator_payout_accounts enable row level security;
create policy payout_accounts_select on public.creator_payout_accounts for select
  using (user_id = auth.uid() or public.is_admin());
create policy payout_accounts_insert on public.creator_payout_accounts for insert
  with check (user_id = auth.uid() and public.me_creator());
create policy payout_accounts_update on public.creator_payout_accounts for update
  using (user_id = auth.uid() and public.me_creator())
  with check (user_id = auth.uid() and public.me_creator());
create policy payout_accounts_delete on public.creator_payout_accounts for delete
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Solicitudes para ser creador (verificación de identidad y de edad)
-- -----------------------------------------------------------------------------
create table public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  legal_name text not null check (char_length(legal_name) between 3 and 120),
  birth_date date not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  id_doc_path text,
  selfie_path text,
  message text check (char_length(message) <= 1000),
  confirms_rights boolean not null check (confirms_rights),
  confirms_adults boolean not null check (confirms_adults),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text check (char_length(review_note) <= 500),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  kyc_purged_at timestamptz,
  created_at timestamptz not null default now(),
  constraint applications_docs_present check (
    kyc_purged_at is not null or (id_doc_path is not null and selfie_path is not null)
  ),
  constraint applications_paths_owner check (
    (id_doc_path is null or split_part(id_doc_path, '/', 1) = user_id::text)
    and (selfie_path is null or split_part(selfie_path, '/', 1) = user_id::text)
  )
);

create unique index creator_applications_one_pending
  on public.creator_applications (user_id) where status = 'pending';
create index creator_applications_status_idx
  on public.creator_applications (status, created_at desc);

create or replace function public.validate_application()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.birth_date > (current_date - interval '18 years')::date then
    raise exception 'Debes tener al menos 18 años para ser creador';
  end if;
  if new.birth_date < date '1900-01-01' then
    raise exception 'Fecha de nacimiento inválida';
  end if;
  if not public.is_adult_user(new.user_id) then
    raise exception 'Confirma que eres mayor de edad antes de enviar la solicitud';
  end if;
  if exists (select 1 from public.creators where user_id = new.user_id) then
    raise exception 'Ya eres creador';
  end if;
  return new;
end;
$$;

create trigger creator_applications_validate
  before insert on public.creator_applications
  for each row execute function public.validate_application();

alter table public.creator_applications enable row level security;
create policy applications_select on public.creator_applications for select
  using (user_id = auth.uid() or public.is_admin());
create policy applications_insert on public.creator_applications for insert
  with check (user_id = auth.uid() and status = 'pending'
              and reviewed_by is null and reviewed_at is null and kyc_purged_at is null);

-- -----------------------------------------------------------------------------
-- Auditoría
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
create policy audit_select on public.audit_log for select using (public.is_admin());

create or replace function public.write_audit(
  p_action text, p_target_type text default null, p_target_id text default null, p_meta jsonb default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_meta);
end;
$$;

-- -----------------------------------------------------------------------------
-- Límite de frecuencia genérico (reemplaza las tablas de rate limit por ruta)
-- -----------------------------------------------------------------------------
create table public.rate_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_events_lookup on public.rate_events (bucket, key, created_at desc);
alter table public.rate_events enable row level security; -- sin políticas: solo funciones internas

create or replace function public.check_rate(
  p_bucket text, p_key text, p_max int, p_window_seconds int
) returns void language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  select count(*) into v_count from public.rate_events
  where bucket = p_bucket and key = p_key
    and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_max then
    raise exception 'Demasiadas solicitudes. Intenta más tarde.';
  end if;
  insert into public.rate_events (bucket, key) values (p_bucket, p_key);
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de funciones
-- -----------------------------------------------------------------------------
revoke all on function public.is_adult_user(uuid) from public, anon, authenticated;
revoke all on function public.is_active_creator(uuid) from public, anon, authenticated;
revoke all on function public.check_rate(text, text, int, int) from public, anon, authenticated;
revoke all on function public.write_audit(text, text, text, jsonb) from public, anon;
grant execute on function public.write_audit(text, text, text, jsonb) to authenticated;
revoke all on function public.confirm_adult() from public, anon;
grant execute on function public.confirm_adult() to authenticated;
