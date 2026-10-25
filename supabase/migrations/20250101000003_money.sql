-- =============================================================================
-- Aura — 003 dinero: libro de transacciones, saldos y retiros.
-- Las funciones que mueven dinero SOLO las puede ejecutar la service role
-- (webhooks del proveedor de pagos). Los clientes nunca escriben en estas tablas.
-- =============================================================================

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('subscription', 'renewal', 'ppv', 'tip')),
  status text not null default 'completed' check (status in ('completed', 'refunded')),
  fan_id uuid references public.profiles(id) on delete set null,
  creator_id uuid references public.profiles(id) on delete set null,
  post_id uuid references public.posts(id) on delete set null,
  gross_cents int not null check (gross_cents > 0),
  fee_cents int not null check (fee_cents >= 0),
  net_cents int not null check (net_cents >= 0),
  fee_bps int not null check (fee_bps between 0 and 5000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider text not null,
  provider_ref text not null,
  provider_ref_alt text,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  refunded_at timestamptz,
  unique (provider, provider_ref),
  check (gross_cents = fee_cents + net_cents)
);
create index transactions_creator_idx on public.transactions (creator_id, created_at desc);
create index transactions_status_idx on public.transactions (status, created_at desc);
create index transactions_alt_idx on public.transactions (provider, provider_ref_alt)
  where provider_ref_alt is not null;

alter table public.transactions enable row level security;
create policy transactions_select on public.transactions for select
  using (creator_id = auth.uid() or fan_id = auth.uid() or public.is_admin());

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  amount_cents int not null check (amount_cents > 0),
  currency text not null,
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  account_snapshot jsonb not null,
  reference text check (char_length(reference) <= 200),
  note text check (char_length(note) <= 500),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);
create unique index payouts_one_open on public.payouts (creator_id) where status = 'requested';
create index payouts_status_idx on public.payouts (status, requested_at desc);

alter table public.payouts enable row level security;
create policy payouts_select on public.payouts for select
  using (creator_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- Registrar un pago (idempotente por proveedor + referencia)
-- -----------------------------------------------------------------------------
create or replace function public.record_payment(
  p_provider text,
  p_provider_ref text,
  p_provider_ref_alt text,
  p_kind text,
  p_fan uuid,
  p_creator uuid,
  p_post uuid,
  p_gross int,
  p_currency text,
  p_period_end timestamptz default null,
  p_provider_subscription_id text default null,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_bps int;
  v_fee int;
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;
  if p_kind not in ('subscription', 'renewal', 'ppv', 'tip') then
    raise exception 'Tipo de pago inválido';
  end if;
  if p_gross is null or p_gross <= 0 then
    raise exception 'Monto inválido';
  end if;
  if p_kind in ('subscription', 'renewal') and p_period_end is null then
    raise exception 'Falta el fin del periodo';
  end if;
  if p_kind = 'ppv' and p_post is null then
    raise exception 'Falta la publicación';
  end if;

  select fee_bps into v_bps from public.platform_settings limit 1;
  v_fee := round(p_gross * v_bps / 10000.0)::int;

  insert into public.transactions (
    kind, fan_id, creator_id, post_id, gross_cents, fee_cents, net_cents, fee_bps,
    currency, provider, provider_ref, provider_ref_alt, note
  ) values (
    p_kind, p_fan, p_creator, p_post, p_gross, v_fee, p_gross - v_fee, v_bps,
    upper(p_currency), p_provider, p_provider_ref, p_provider_ref_alt,
    nullif(left(trim(coalesce(p_note, '')), 200), '')
  )
  on conflict (provider, provider_ref) do nothing
  returning id into v_id;

  if v_id is null then
    return null;   -- ya procesado
  end if;

  if p_kind in ('subscription', 'renewal') then
    insert into public.subscriptions (
      fan_id, creator_id, status, price_cents, current_period_end, provider, provider_subscription_id
    ) values (
      p_fan, p_creator, 'active', p_gross, p_period_end, p_provider, p_provider_subscription_id
    )
    on conflict (fan_id, creator_id) do update set
      status = 'active',
      cancel_at_period_end = false,
      price_cents = excluded.price_cents,
      provider = excluded.provider,
      provider_subscription_id = coalesce(excluded.provider_subscription_id, public.subscriptions.provider_subscription_id),
      current_period_end = case
        when public.subscriptions.provider = 'free' then excluded.current_period_end
        else greatest(public.subscriptions.current_period_end, excluded.current_period_end)
      end;
  elsif p_kind = 'ppv' then
    insert into public.purchases (fan_id, post_id, amount_cents)
    values (p_fan, p_post, p_gross)
    on conflict do nothing;
  end if;

  return v_id;
end;
$$;

-- Reembolso o contracargo: revoca el acceso que esa venta había dado
create or replace function public.record_refund(p_provider text, p_ref text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  t public.transactions;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;

  update public.transactions
    set status = 'refunded', refunded_at = now()
  where provider = p_provider
    and (provider_ref = p_ref or provider_ref_alt = p_ref)
    and status = 'completed'
  returning * into t;

  if t.id is null then
    return false;
  end if;

  if t.kind = 'ppv' and t.fan_id is not null and t.post_id is not null then
    delete from public.purchases where fan_id = t.fan_id and post_id = t.post_id;
  elsif t.kind in ('subscription', 'renewal') and t.fan_id is not null and t.creator_id is not null then
    -- solo corta el acceso si no hubo un cobro posterior vigente
    if not exists (
      select 1 from public.transactions x
      where x.fan_id = t.fan_id and x.creator_id = t.creator_id
        and x.kind in ('subscription', 'renewal') and x.status = 'completed'
        and x.created_at > t.created_at
    ) then
      update public.subscriptions
        set status = 'expired', current_period_end = now(), cancel_at_period_end = true
      where fan_id = t.fan_id and creator_id = t.creator_id and provider = p_provider;
    end if;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (null, 'refund', 'transaction', t.id::text,
          jsonb_build_object('kind', t.kind, 'gross_cents', t.gross_cents, 'provider', p_provider));
  return true;
end;
$$;

-- Sincronizar el estado de una suscripción desde el proveedor
create or replace function public.set_subscription_state(
  p_provider text,
  p_provider_subscription_id text,
  p_status text,
  p_period_end timestamptz default null,
  p_cancel_at_period_end boolean default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;
  if p_status not in ('active', 'past_due', 'canceled', 'expired') then
    raise exception 'Estado inválido';
  end if;

  update public.subscriptions set
    status = p_status,
    current_period_end = case
      when p_status = 'expired' then now()
      else coalesce(p_period_end, current_period_end)
    end,
    cancel_at_period_end = coalesce(p_cancel_at_period_end, cancel_at_period_end)
  where provider = p_provider and provider_subscription_id = p_provider_subscription_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Saldo del creador
--   disponible = ventas netas con más de hold_days días − retiros pagados − retiros pendientes
-- -----------------------------------------------------------------------------
create or replace function public.creator_balance(p_creator uuid default null)
returns table (
  earned_cents bigint, available_cents bigint, hold_cents bigint,
  pending_payout_cents bigint, paid_out_cents bigint, min_payout_cents int, currency text
)
language sql stable security definer set search_path = '' as $$
  with cfg as (
    select hold_days, platform_settings.min_payout_cents as min_payout, platform_settings.currency as cur
    from public.platform_settings limit 1
  ),
  v as (select coalesce(p_creator, auth.uid()) as id),
  t as (
    select
      coalesce(sum(x.net_cents) filter (where x.status = 'completed'), 0) as earned,
      coalesce(sum(x.net_cents) filter (
        where x.status = 'completed'
          and x.created_at <= now() - make_interval(days => (select hold_days from cfg))
      ), 0) as matured
    from public.transactions x where x.creator_id = (select id from v)
  ),
  p as (
    select
      coalesce(sum(y.amount_cents) filter (where y.status = 'paid'), 0) as paid,
      coalesce(sum(y.amount_cents) filter (where y.status = 'requested'), 0) as pending
    from public.payouts y where y.creator_id = (select id from v)
  )
  select
    t.earned::bigint,
    greatest(t.matured - p.paid - p.pending, 0)::bigint,
    greatest(t.earned - t.matured, 0)::bigint,
    p.pending::bigint,
    p.paid::bigint,
    cfg.min_payout,
    cfg.cur
  from cfg, t, p
  where (select id from v) = auth.uid() or public.is_admin();
$$;

create or replace function public.my_earnings(p_limit int default 20, p_offset int default 0)
returns table (
  id uuid, kind text, status text, gross_cents int, fee_cents int, net_cents int,
  currency text, note text, fan_username text, created_at timestamptz, total bigint
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.kind, t.status, t.gross_cents, t.fee_cents, t.net_cents, t.currency,
         t.note, pr.username, t.created_at, count(*) over ()
  from public.transactions t
  left join public.profiles pr on pr.id = t.fan_id
  where t.creator_id = auth.uid() and public.me_creator()
  order by t.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Solicitar un retiro
create or replace function public.request_payout(p_amount int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_bal record;
  v_acc public.creator_payout_accounts;
  v_id uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not public.me_creator() then raise exception 'Solo creadores activos pueden solicitar retiros'; end if;

  perform pg_advisory_xact_lock(hashtext('payout:' || v_uid::text));
  perform public.check_rate('payout', v_uid::text, 5, 86400);

  select * into v_acc from public.creator_payout_accounts where user_id = v_uid;
  if v_acc.user_id is null then
    raise exception 'Configura tu cuenta para recibir pagos antes de retirar';
  end if;

  select * into v_bal from public.creator_balance();
  if p_amount is null or p_amount < v_bal.min_payout_cents then
    raise exception 'El retiro mínimo es de % centavos', v_bal.min_payout_cents;
  end if;
  if p_amount > v_bal.available_cents then
    raise exception 'Saldo disponible insuficiente';
  end if;

  insert into public.payouts (creator_id, amount_cents, currency, account_snapshot)
  values (v_uid, p_amount, v_bal.currency,
          jsonb_build_object('holder_name', v_acc.holder_name, 'account_ref', v_acc.account_ref,
                             'bank_name', v_acc.bank_name))
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke all on function public.record_payment(text, text, text, text, uuid, uuid, uuid, int, text, timestamptz, text, text)
  from public, anon, authenticated;
revoke all on function public.record_refund(text, text) from public, anon, authenticated;
revoke all on function public.set_subscription_state(text, text, text, timestamptz, boolean)
  from public, anon, authenticated;
revoke all on function public.creator_balance(uuid) from public, anon;
grant execute on function public.creator_balance(uuid) to authenticated;
revoke all on function public.my_earnings(int, int) from public, anon;
grant execute on function public.my_earnings(int, int) to authenticated;
revoke all on function public.request_payout(int) from public, anon;
grant execute on function public.request_payout(int) to authenticated;
