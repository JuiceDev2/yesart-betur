-- =============================================================================
-- Aura — 004 mensajes, reportes y herramientas de administración
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Mensajes directos (solo entre un creador y sus suscriptores)
-- -----------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index messages_sender_idx on public.messages (sender_id, recipient_id, created_at desc);
create index messages_recipient_idx on public.messages (recipient_id, sender_id, created_at desc);

alter table public.messages enable row level security;
create policy messages_select on public.messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- INTERNA
create or replace function public.can_message(p_from uuid, p_to uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_from <> p_to
    and public.is_adult_user(p_from) and public.is_adult_user(p_to)
    and (
      (public.is_active_creator(p_to) and public.has_access(p_from, p_to))
      or (public.is_active_creator(p_from) and public.has_access(p_to, p_from))
    );
$$;

create or replace function public.send_message(p_to uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_body text := left(trim(coalesce(p_body, '')), 2000);
  v_id uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if char_length(v_body) < 1 then raise exception 'Mensaje vacío'; end if;
  if not public.can_message(v_uid, p_to) then
    raise exception 'No puedes enviar mensajes a este usuario';
  end if;
  perform public.check_rate('message', v_uid::text, 30, 60);
  insert into public.messages (sender_id, recipient_id, body)
  values (v_uid, p_to, v_body) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.mark_thread_read(p_other uuid)
returns void language sql security definer set search_path = '' as $$
  update public.messages set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_other and read_at is null;
$$;

create or replace function public.unread_count()
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.messages
  where recipient_id = auth.uid() and read_at is null;
$$;

create or replace function public.conversations()
returns table (
  other_id uuid, username text, display_name text, avatar_url text,
  last_body text, last_at timestamptz, last_from_me boolean, unread int, can_reply boolean
)
language sql stable security definer set search_path = '' as $$
  with m as (
    select case when sender_id = auth.uid() then recipient_id else sender_id end as other,
           sender_id, recipient_id, body, created_at, read_at
    from public.messages
    where sender_id = auth.uid() or recipient_id = auth.uid()
  ),
  last_msg as (
    select distinct on (other) other, body, created_at, sender_id
    from m order by other, created_at desc
  ),
  unread_by as (
    select other, count(*) as c from m
    where recipient_id = auth.uid() and read_at is null group by other
  )
  select l.other, pr.username, pr.display_name, pr.avatar_url,
         left(l.body, 120), l.created_at, l.sender_id = auth.uid(),
         coalesce(u.c, 0)::int, public.can_message(auth.uid(), l.other)
  from last_msg l
  join public.profiles pr on pr.id = l.other
  left join unread_by u on u.other = l.other
  order by l.created_at desc
  limit 100;
$$;

-- Datos mínimos de la otra persona de una conversación
create or replace function public.counterpart(p_other uuid)
returns table (
  id uuid, username text, display_name text, avatar_url text,
  is_creator boolean, can_message boolean
)
language sql stable security definer set search_path = '' as $$
  select pr.id, pr.username, pr.display_name, pr.avatar_url,
         public.is_active_creator(pr.id), public.can_message(auth.uid(), pr.id)
  from public.profiles pr
  where pr.id = p_other and pr.is_active and auth.uid() is not null
    and (
      public.is_active_creator(pr.id)
      or exists (select 1 from public.messages m
                 where (m.sender_id = auth.uid() and m.recipient_id = pr.id)
                    or (m.recipient_id = auth.uid() and m.sender_id = pr.id))
      or exists (select 1 from public.subscriptions s
                 where s.creator_id = auth.uid() and s.fan_id = pr.id)
    );
$$;

-- -----------------------------------------------------------------------------
-- Reportes de contenido
-- -----------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('post', 'creator', 'comment', 'message')),
  target_id uuid not null,
  reason text not null check (reason in
    ('minor', 'non_consensual', 'illegal', 'spam', 'impersonation', 'harassment', 'copyright', 'other')),
  details text check (char_length(details) <= 1000),
  priority boolean not null default false,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolution_note text check (char_length(resolution_note) <= 500),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_status_idx on public.reports (status, priority desc, created_at desc);

alter table public.reports enable row level security;
create policy reports_select on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());

create or replace function public.report_content(
  p_type text, p_target uuid, p_reason text, p_details text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_priority boolean := p_reason in ('minor', 'non_consensual', 'illegal');
  v_exists boolean;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  v_exists := case p_type
    when 'post' then exists (select 1 from public.posts where id = p_target)
    when 'creator' then exists (select 1 from public.creators where user_id = p_target)
    when 'comment' then exists (select 1 from public.comments where id = p_target)
    when 'message' then exists (select 1 from public.messages
                                where id = p_target and (sender_id = v_uid or recipient_id = v_uid))
    else false
  end;
  if not v_exists then raise exception 'Contenido no encontrado'; end if;

  perform public.check_rate('report', v_uid::text, 15, 3600);

  insert into public.reports (reporter_id, target_type, target_id, reason, details, priority)
  values (v_uid, p_type, p_target, p_reason, nullif(left(trim(coalesce(p_details, '')), 1000), ''), v_priority)
  on conflict (reporter_id, target_type, target_id) do nothing;

  -- Seguridad primero: una publicación reportada por menores / sin consentimiento /
  -- ilegal se oculta de inmediato mientras un administrador la revisa.
  if p_type = 'post' and v_priority then
    perform set_config('app.internal', '1', true);
    update public.posts
      set is_hidden = true,
          hidden_reason = 'Oculta automáticamente por un reporte prioritario (en revisión)'
    where id = p_target and not is_hidden;
    perform set_config('app.internal', '0', true);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Administración
-- -----------------------------------------------------------------------------
create or replace function public.admin_review_application(
  p_app uuid, p_approve boolean, p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.creator_applications;
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;

  select * into a from public.creator_applications where id = p_app and status = 'pending' for update;
  if a.id is null then raise exception 'Solicitud no encontrada o ya procesada'; end if;

  update public.creator_applications
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_by = auth.uid(), reviewed_at = now(),
        review_note = nullif(left(trim(coalesce(p_note, '')), 500), '')
  where id = p_app;

  if p_approve then
    update public.profiles set role = 'creator' where id = a.user_id and role = 'fan';
    insert into public.creators (user_id) values (a.user_id) on conflict do nothing;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), case when p_approve then 'approve_creator' else 'reject_creator' end,
          'application', p_app::text,
          jsonb_build_object('user_id', a.user_id, 'note', nullif(left(trim(coalesce(p_note, '')), 500), '')));
  return a.user_id;
end;
$$;

create or replace function public.admin_set_creator_status(
  p_creator uuid, p_status text, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'Estado inválido'; end if;

  update public.creators
    set status = p_status,
        suspended_reason = case when p_status = 'suspended'
          then nullif(left(trim(coalesce(p_reason, '')), 500), '') else null end
  where user_id = p_creator;
  if not found then raise exception 'Creador no encontrado'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), case when p_status = 'suspended' then 'suspend_creator' else 'reactivate_creator' end,
          'profile', p_creator::text,
          jsonb_build_object('reason', nullif(left(trim(coalesce(p_reason, '')), 500), '')));
end;
$$;

create or replace function public.admin_set_user_active(
  p_user uuid, p_active boolean, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  update public.profiles set is_active = p_active where id = p_user;
  if not found then raise exception 'Usuario no encontrado'; end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), case when p_active then 'enable_user' else 'disable_user' end,
          'profile', p_user::text,
          jsonb_build_object('reason', nullif(left(trim(coalesce(p_reason, '')), 500), '')));
end;
$$;

create or replace function public.admin_moderate_post(
  p_post uuid, p_hidden boolean, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  update public.posts
    set is_hidden = p_hidden,
        hidden_reason = case when p_hidden then nullif(left(trim(coalesce(p_reason, '')), 500), '') else null end
  where id = p_post;
  if not found then raise exception 'Publicación no encontrada'; end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), case when p_hidden then 'hide_post' else 'unhide_post' end,
          'post', p_post::text,
          jsonb_build_object('reason', nullif(left(trim(coalesce(p_reason, '')), 500), '')));
end;
$$;

create or replace function public.admin_resolve_report(
  p_report uuid, p_status text, p_note text default null, p_hide_target boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.reports;
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  if p_status not in ('actioned', 'dismissed') then raise exception 'Estado inválido'; end if;

  select * into r from public.reports where id = p_report and status = 'open' for update;
  if r.id is null then raise exception 'Reporte no encontrado o ya resuelto'; end if;

  if p_hide_target then
    if r.target_type = 'post' then
      update public.posts set is_hidden = true,
        hidden_reason = coalesce(nullif(left(trim(coalesce(p_note, '')), 500), ''), 'Retirada por moderación')
      where id = r.target_id;
    elsif r.target_type = 'comment' then
      update public.comments set is_hidden = true where id = r.target_id;
    end if;
  elsif p_status = 'dismissed' and r.target_type = 'post' then
    -- se descarta el reporte: si la publicación fue ocultada automáticamente, se restaura
    update public.posts set is_hidden = false, hidden_reason = null
    where id = r.target_id and is_hidden
      and hidden_reason like 'Oculta automáticamente%'
      and not exists (select 1 from public.reports o
                      where o.target_type = 'post' and o.target_id = r.target_id
                        and o.status = 'open' and o.id <> r.id);
  end if;

  update public.reports
    set status = p_status, handled_by = auth.uid(), handled_at = now(),
        resolution_note = nullif(left(trim(coalesce(p_note, '')), 500), '')
  where id = p_report;

  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), 'resolve_report', 'report', p_report::text,
          jsonb_build_object('status', p_status, 'hidden', p_hide_target,
                             'target_type', r.target_type, 'target_id', r.target_id));
end;
$$;

create or replace function public.admin_resolve_payout(
  p_payout uuid, p_status text, p_reference text default null, p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  p public.payouts;
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  if p_status not in ('paid', 'rejected') then raise exception 'Estado inválido'; end if;
  if p_status = 'paid' and coalesce(trim(p_reference), '') = '' then
    raise exception 'Indica la referencia del pago (por ejemplo, la clave de rastreo)';
  end if;

  update public.payouts
    set status = p_status, resolved_at = now(), resolved_by = auth.uid(),
        reference = nullif(left(trim(coalesce(p_reference, '')), 200), ''),
        note = nullif(left(trim(coalesce(p_note, '')), 500), '')
  where id = p_payout and status = 'requested'
  returning * into p;
  if p.id is null then raise exception 'Retiro no encontrado o ya resuelto'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), case when p_status = 'paid' then 'payout_paid' else 'payout_rejected' end,
          'payout', p_payout::text,
          jsonb_build_object('amount_cents', p.amount_cents, 'creator_id', p.creator_id));
  return p.creator_id;
end;
$$;

create or replace function public.admin_reports(
  p_status text default 'open', p_limit int default 20, p_offset int default 0
) returns table (
  id uuid, target_type text, target_id uuid, reason text, details text, priority boolean,
  status text, resolution_note text, created_at timestamptz,
  reporter_username text, target_label text, target_owner uuid, target_hidden boolean, total bigint
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.priority, r.status,
         r.resolution_note, r.created_at, rp.username,
         case r.target_type
           when 'post' then left(coalesce(nullif(po.body, ''), po.teaser, '(sin texto)'), 160)
           when 'creator' then '@' || cp.username
           when 'comment' then left(co.body, 160)
           else left(me.body, 160)
         end,
         case r.target_type
           when 'post' then po.creator_id
           when 'creator' then r.target_id
           when 'comment' then co.user_id
           else me.sender_id
         end,
         case r.target_type when 'post' then po.is_hidden when 'comment' then co.is_hidden else false end,
         count(*) over ()
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.posts po on r.target_type = 'post' and po.id = r.target_id
  left join public.profiles cp on r.target_type = 'creator' and cp.id = r.target_id
  left join public.comments co on r.target_type = 'comment' and co.id = r.target_id
  left join public.messages me on r.target_type = 'message' and me.id = r.target_id
  where public.is_admin() and (p_status is null or r.status = p_status)
  order by r.priority desc, r.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.admin_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then jsonb_build_object(
    'pending_applications', (select count(*) from public.creator_applications where status = 'pending'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'priority_reports', (select count(*) from public.reports where status = 'open' and priority),
    'requested_payouts', (select count(*) from public.payouts where status = 'requested'),
    'requested_payouts_cents', (select coalesce(sum(amount_cents), 0) from public.payouts where status = 'requested'),
    'active_creators', (select count(*) from public.creators where status = 'active'),
    'fans', (select count(*) from public.profiles where role = 'fan'),
    'gross_30d', (select coalesce(sum(gross_cents), 0) from public.transactions
                  where status = 'completed' and created_at > now() - interval '30 days'),
    'fees_30d', (select coalesce(sum(fee_cents), 0) from public.transactions
                 where status = 'completed' and created_at > now() - interval '30 days'),
    'tx_30d', (select count(*) from public.transactions
               where status = 'completed' and created_at > now() - interval '30 days')
  ) else null end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke all on function public.can_message(uuid, uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.send_message(uuid, text)', 'public.mark_thread_read(uuid)', 'public.unread_count()',
    'public.conversations()', 'public.counterpart(uuid)',
    'public.report_content(text, uuid, text, text)',
    'public.admin_review_application(uuid, boolean, text)',
    'public.admin_set_creator_status(uuid, text, text)',
    'public.admin_set_user_active(uuid, boolean, text)',
    'public.admin_moderate_post(uuid, boolean, text)',
    'public.admin_resolve_report(uuid, text, text, boolean)',
    'public.admin_resolve_payout(uuid, text, text, text)',
    'public.admin_reports(text, int, int)', 'public.admin_stats()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
