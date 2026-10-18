-- 007: indexes + retention helpers (additive only)

create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);

create index if not exists orders_artist_created_idx
  on public.orders (artist_id, created_at desc);

create index if not exists orders_client_user_idx
  on public.orders (client_user_id, created_at desc)
  where client_user_id is not null;

create index if not exists artworks_artist_status_idx
  on public.artworks (artist_id, status, is_hidden);

create index if not exists services_artist_active_idx
  on public.services (artist_id, is_active, is_hidden);

create index if not exists artist_applications_status_idx
  on public.artist_applications (status, created_at desc);

-- Keep audit_log from growing forever (optional manual/cron)
create or replace function public.cleanup_old_audit(p_days int default 180)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;
  delete from public.audit_log
  where created_at < now() - make_interval(days => p_days);
end;
$$;

revoke all on function public.cleanup_old_audit(int) from public, anon, authenticated;
