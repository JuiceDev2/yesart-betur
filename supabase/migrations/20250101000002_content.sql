-- =============================================================================
-- Aura — 002 contenido: suscripciones, compras, bloqueos, publicaciones, media,
-- likes, comentarios, control de acceso y feeds.
-- El acceso al contenido se decide SIEMPRE en la base de datos (can_view_post).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Suscripciones / compras / bloqueos
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.creators(user_id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'past_due', 'canceled', 'expired')),
  cancel_at_period_end boolean not null default false,
  price_cents int not null check (price_cents >= 0),
  current_period_end timestamptz not null,
  provider text not null default 'free',
  provider_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fan_id, creator_id),
  check (fan_id <> creator_id)
);
create index subscriptions_creator_idx on public.subscriptions (creator_id, status, current_period_end);
create index subscriptions_fan_idx on public.subscriptions (fan_id, status);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.purchases (
  fan_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null,   -- FK a posts se añade más abajo
  amount_cents int not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  primary key (fan_id, post_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ¿tiene este fan acceso de suscriptor a este creador? (INTERNA)
create or replace function public.has_access(p_fan uuid, p_creator uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_fan is not null
    and (
      p_fan = p_creator
      or exists (
        select 1 from public.subscriptions s
        where s.fan_id = p_fan and s.creator_id = p_creator
          and s.status in ('active', 'canceled')
          and s.current_period_end > now()
      )
    )
    and not exists (
      select 1 from public.blocks b where b.blocker_id = p_creator and b.blocked_id = p_fan
    );
$$;

-- -----------------------------------------------------------------------------
-- Publicaciones
-- -----------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(user_id) on delete cascade,
  body text not null default '' check (char_length(body) <= 5000),
  teaser text check (char_length(teaser) <= 200),
  visibility text not null default 'subscribers'
    check (visibility in ('free', 'subscribers', 'ppv')),
  price_cents int,
  is_nsfw boolean not null default false,
  is_hidden boolean not null default false,
  hidden_reason text check (char_length(hidden_reason) <= 500),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_price_rule check (
    (visibility = 'ppv' and coalesce(price_cents between 1000 and 500000, false))
    or (visibility <> 'ppv' and price_cents is null)
  )
);
create index posts_creator_published_idx on public.posts (creator_id, published_at desc);
create index posts_published_idx on public.posts (published_at desc) where not is_hidden;

alter table public.purchases
  add constraint purchases_post_fk foreign key (post_id) references public.posts(id) on delete cascade;

create or replace function public.posts_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_nsfw boolean;
  v_priv boolean := public.is_admin() or public.internal_flag()
    or (auth.uid() is null and (auth.role() is null or auth.role() = 'service_role'));
begin
  -- Un creador marcado como adulto publica siempre contenido adulto
  select is_nsfw into v_nsfw from public.creators where user_id = new.creator_id;
  if coalesce(v_nsfw, false) then new.is_nsfw := true; end if;

  if tg_op = 'INSERT' then
    if not v_priv then
      new.is_hidden := false;
      new.hidden_reason := null;
      if new.published_at < now() then new.published_at := now(); end if;
      if new.published_at > now() + interval '90 days' then
        raise exception 'No puedes programar con más de 90 días de anticipación';
      end if;
    end if;
  else
    if not v_priv then
      if new.creator_id is distinct from old.creator_id
         or new.is_hidden is distinct from old.is_hidden
         or new.hidden_reason is distinct from old.hidden_reason then
        raise exception 'No autorizado a modificar estos campos';
      end if;
      if new.published_at is distinct from old.published_at then
        if old.published_at <= now() then
          new.published_at := old.published_at;       -- ya publicada: no se mueve
        elsif new.published_at < now() then
          new.published_at := now();
        end if;
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger posts_guard_trg
  before insert or update on public.posts
  for each row execute function public.posts_guard();

-- Archivos de una publicación (viven en el bucket PRIVADO "media")
create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  creator_id uuid not null references public.creators(user_id) on delete cascade,
  path text not null unique,
  kind text not null check (kind in ('image', 'video')),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint post_media_path_shape check (
    split_part(path, '/', 1) = creator_id::text and split_part(path, '/', 2) = post_id::text
  )
);
create index post_media_post_idx on public.post_media (post_id, position);

create or replace function public.post_media_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.post_media where post_id = new.post_id) >= 10 then
    raise exception 'Máximo 10 archivos por publicación';
  end if;
  return new;
end;
$$;
create trigger post_media_limit_trg
  before insert on public.post_media
  for each row execute function public.post_media_limit();

create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at desc);

create or replace function public.comments_rate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_rate('comment', new.user_id::text, 20, 300);
  return new;
end;
$$;
create trigger comments_rate_trg
  before insert on public.comments
  for each row execute function public.comments_rate();

-- -----------------------------------------------------------------------------
-- Regla central de acceso
-- -----------------------------------------------------------------------------
create or replace function public.can_view_post(p_post uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.posts p
    join public.creators c on c.user_id = p.creator_id
    join public.profiles cp on cp.id = p.creator_id
    where p.id = p_post
      and (
        -- el dueño y los administradores ven todo
        p.creator_id = auth.uid()
        or public.is_admin()
        or (
          not p.is_hidden
          and p.published_at <= now()
          and c.status = 'active'
          and cp.is_active
          and (not p.is_nsfw or public.me_adult())
          and not exists (
            select 1 from public.blocks b
            where b.blocker_id = p.creator_id and b.blocked_id = auth.uid()
          )
          and (
            p.visibility = 'free'
            or (p.visibility = 'subscribers' and public.has_access(auth.uid(), p.creator_id))
            or (p.visibility = 'ppv' and exists (
                  select 1 from public.purchases pu
                  where pu.post_id = p.id and pu.fan_id = auth.uid()))
          )
        )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
create policy subscriptions_select on public.subscriptions for select
  using (fan_id = auth.uid() or creator_id = auth.uid() or public.is_admin());

alter table public.purchases enable row level security;
create policy purchases_select on public.purchases for select
  using (fan_id = auth.uid() or public.is_admin());

alter table public.blocks enable row level security;
create policy blocks_select on public.blocks for select using (blocker_id = auth.uid());
create policy blocks_insert on public.blocks for insert
  with check (blocker_id = auth.uid() and public.me_creator());
create policy blocks_delete on public.blocks for delete using (blocker_id = auth.uid());

alter table public.posts enable row level security;
create policy posts_select on public.posts for select using (public.can_view_post(id));
create policy posts_insert on public.posts for insert
  with check (creator_id = auth.uid() and public.me_creator());
create policy posts_update on public.posts for update
  using (creator_id = auth.uid() and public.me_creator())
  with check (creator_id = auth.uid() and public.me_creator());
create policy posts_delete on public.posts for delete using (creator_id = auth.uid());

alter table public.post_media enable row level security;
create policy post_media_select on public.post_media for select
  using (public.can_view_post(post_id));
create policy post_media_insert on public.post_media for insert
  with check (
    creator_id = auth.uid() and public.me_creator()
    and exists (select 1 from public.posts p where p.id = post_id and p.creator_id = auth.uid())
  );
create policy post_media_delete on public.post_media for delete using (creator_id = auth.uid());

alter table public.likes enable row level security;
create policy likes_select on public.likes for select using (user_id = auth.uid());
create policy likes_insert on public.likes for insert
  with check (user_id = auth.uid() and public.me_adult() and public.can_view_post(post_id));
create policy likes_delete on public.likes for delete using (user_id = auth.uid());

alter table public.comments enable row level security;
create policy comments_select on public.comments for select
  using (
    public.can_view_post(post_id)
    and (not is_hidden or user_id = auth.uid() or public.is_admin())
  );
create policy comments_insert on public.comments for insert
  with check (
    user_id = auth.uid() and not is_hidden
    and public.me_adult() and public.can_view_post(post_id)
  );
create policy comments_delete on public.comments for delete
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.posts p where p.id = post_id and p.creator_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- Suscripción gratuita ("seguir")
-- -----------------------------------------------------------------------------
create or replace function public.follow_creator(p_creator uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_price int;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not public.me_adult() then raise exception 'Confirma que eres mayor de edad'; end if;
  if v_uid = p_creator then raise exception 'No puedes seguirte a ti mismo'; end if;

  select c.price_cents into v_price from public.creators c
  where c.user_id = p_creator and public.is_active_creator(p_creator);
  if v_price is null then raise exception 'Creador no disponible'; end if;
  if v_price > 0 then raise exception 'Este creador requiere suscripción de pago'; end if;
  if exists (select 1 from public.blocks where blocker_id = p_creator and blocked_id = v_uid) then
    raise exception 'Creador no disponible';
  end if;

  perform public.check_rate('follow', v_uid::text, 30, 3600);

  insert into public.subscriptions (fan_id, creator_id, status, price_cents, current_period_end, provider)
  values (v_uid, p_creator, 'active', 0, 'infinity', 'free')
  on conflict (fan_id, creator_id) do update
    set status = 'active', cancel_at_period_end = false, price_cents = 0,
        current_period_end = 'infinity', provider_subscription_id = null
    where public.subscriptions.provider = 'free';
end;
$$;

create or replace function public.unfollow_creator(p_creator uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  delete from public.subscriptions
  where fan_id = auth.uid() and creator_id = p_creator and provider = 'free';
end;
$$;

-- Si el creador pasa de gratis a pago, los seguidores gratuitos dejan de tener acceso
-- (evita "regalar" acceso permanente cambiando el precio).
create or replace function public.creators_price_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.price_cents = 0 and new.price_cents > 0 then
    update public.subscriptions
      set status = 'expired', current_period_end = now()
    where creator_id = new.user_id and provider = 'free' and status = 'active';
  end if;
  return new;
end;
$$;
create trigger creators_price_change_trg
  after update of price_cents on public.creators
  for each row execute function public.creators_price_change();

-- -----------------------------------------------------------------------------
-- Feeds y consultas que combinan datos privados (SECURITY DEFINER, solo lo permitido)
-- -----------------------------------------------------------------------------
-- p_post → una publicación; p_creator → perfil de un creador; p_home → mis suscripciones.
create or replace function public.get_feed(
  p_creator uuid default null,
  p_home boolean default false,
  p_post uuid default null,
  p_before timestamptz default null,
  p_limit int default 12
)
returns table (
  id uuid, creator_id uuid, username text, display_name text, avatar_url text,
  body text, teaser text, visibility text, price_cents int, is_nsfw boolean,
  is_hidden boolean, published_at timestamptz,
  like_count int, comment_count int, locked boolean, liked boolean,
  image_count int, video_count int
)
language sql stable security definer set search_path = '' as $$
  select
    p.id, p.creator_id, pr.username, pr.display_name, pr.avatar_url,
    case when v.ok then p.body else null end,
    p.teaser, p.visibility, p.price_cents, p.is_nsfw, p.is_hidden, p.published_at,
    (select count(*)::int from public.likes l where l.post_id = p.id),
    (select count(*)::int from public.comments c where c.post_id = p.id and not c.is_hidden),
    not v.ok,
    exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()),
    (select count(*)::int from public.post_media m where m.post_id = p.id and m.kind = 'image'),
    (select count(*)::int from public.post_media m where m.post_id = p.id and m.kind = 'video')
  from public.posts p
  join public.creators cr on cr.user_id = p.creator_id and cr.status = 'active'
  join public.profiles pr on pr.id = p.creator_id and pr.is_active
  cross join lateral (select public.can_view_post(p.id) as ok) v
  where (p_before is null or p.published_at < p_before)
    and (p.creator_id = auth.uid() or (not p.is_hidden and p.published_at <= now()))
    and (
      case
        when p_post is not null then p.id = p_post
        when p_home then auth.uid() is not null
                         and (p.creator_id = auth.uid() or public.has_access(auth.uid(), p.creator_id))
        else p_creator is not null and p.creator_id = p_creator
      end
    )
  order by p.published_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

create or replace function public.get_comments(
  p_post uuid, p_before timestamptz default null, p_limit int default 20
)
returns table (
  id uuid, user_id uuid, username text, display_name text, avatar_url text,
  body text, created_at timestamptz, mine boolean, can_delete boolean
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.user_id, pr.username, pr.display_name, pr.avatar_url, c.body, c.created_at,
         c.user_id = auth.uid(),
         (c.user_id = auth.uid() or public.is_admin()
           or exists (select 1 from public.posts p where p.id = c.post_id and p.creator_id = auth.uid()))
  from public.comments c
  join public.profiles pr on pr.id = c.user_id
  where c.post_id = p_post
    and public.can_view_post(p_post)
    and not c.is_hidden
    and (p_before is null or c.created_at < p_before)
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- Mis suscripciones (con datos públicos del creador)
create or replace function public.my_subscriptions()
returns table (
  id uuid, creator_id uuid, username text, display_name text, avatar_url text,
  status text, price_cents int, provider text, cancel_at_period_end boolean,
  current_period_end timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.creator_id, pr.username, pr.display_name, pr.avatar_url, s.status,
         s.price_cents, s.provider, s.cancel_at_period_end, s.current_period_end, s.created_at
  from public.subscriptions s
  join public.profiles pr on pr.id = s.creator_id
  where s.fan_id = auth.uid()
  order by s.created_at desc;
$$;

-- Mis suscriptores (solo para el creador)
create or replace function public.my_subscribers(p_limit int default 20, p_offset int default 0)
returns table (
  fan_id uuid, username text, display_name text, avatar_url text, status text,
  price_cents int, provider text, current_period_end timestamptz, since timestamptz, total bigint
)
language sql stable security definer set search_path = '' as $$
  select s.fan_id, pr.username, pr.display_name, pr.avatar_url, s.status, s.price_cents,
         s.provider, s.current_period_end, s.created_at, count(*) over ()
  from public.subscriptions s
  join public.profiles pr on pr.id = s.fan_id
  where s.creator_id = auth.uid() and public.me_creator()
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- -----------------------------------------------------------------------------
-- Directorio público de creadores (sin correo ni datos privados)
-- -----------------------------------------------------------------------------
create view public.public_creators
with (security_barrier = true) as
select
  p.id, p.username, p.display_name, p.bio, p.avatar_url, p.banner_url,
  c.price_cents, c.category, c.is_nsfw, c.created_at,
  (select count(*) from public.posts x
     where x.creator_id = p.id and not x.is_hidden and x.published_at <= now())::int as post_count,
  (select max(x.published_at) from public.posts x
     where x.creator_id = p.id and not x.is_hidden and x.published_at <= now()) as last_post_at
from public.profiles p
join public.creators c on c.user_id = p.id
where c.status = 'active' and p.is_active;

grant select on public.public_creators to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke all on function public.has_access(uuid, uuid) from public, anon, authenticated;
revoke all on function public.follow_creator(uuid) from public, anon;
grant execute on function public.follow_creator(uuid) to authenticated;
revoke all on function public.unfollow_creator(uuid) from public, anon;
grant execute on function public.unfollow_creator(uuid) to authenticated;
revoke all on function public.my_subscriptions() from public, anon;
grant execute on function public.my_subscriptions() to authenticated;
revoke all on function public.my_subscribers(int, int) from public, anon;
grant execute on function public.my_subscribers(int, int) to authenticated;
-- get_feed, get_comments y can_view_post quedan disponibles también para visitantes
