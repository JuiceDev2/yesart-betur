-- =============================================================================
-- Migration 004: audit lock, order status for active artists only, storage with check
-- (Do NOT re-edit previous migrations if already applied.)
-- =============================================================================

-- 1. write_audit: only admins
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
  if not public.is_admin() then
    raise exception 'Solo administradores pueden escribir auditoría';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_meta);
end;
$$;

revoke all on function public.write_audit(text, text, text, jsonb) from anon, public;
grant execute on function public.write_audit(text, text, text, jsonb) to authenticated;

-- 2. update_order_status: artist must still be active (except admin)
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

  -- Admin: full machine
  if public.is_admin() then
    if not (
      (v_order.status = 'pending' and p_new_status in ('contacted', 'cancelled'))
      or (v_order.status = 'contacted' and p_new_status in ('completed', 'cancelled'))
    ) then
      raise exception 'Transición de estado no permitida';
    end if;
    update public.orders set status = p_new_status where id = p_order_id;
    return;
  end if;

  -- Active artist owner only
  if v_order.artist_id is not distinct from v_uid then
    if not public.is_active_artist(v_uid) then
      raise exception 'Cuenta de artista deshabilitada';
    end if;
    if not (
      (v_order.status = 'pending' and p_new_status in ('contacted', 'cancelled'))
      or (v_order.status = 'contacted' and p_new_status in ('completed', 'cancelled'))
    ) then
      raise exception 'Transición de estado no permitida';
    end if;
    update public.orders set status = p_new_status where id = p_order_id;
    return;
  end if;

  -- Client: cancel own pending only
  if v_order.client_user_id is not distinct from v_uid
     and v_order.status = 'pending'
     and p_new_status = 'cancelled' then
    update public.orders set status = 'cancelled' where id = p_order_id;
    return;
  end if;

  raise exception 'No autorizado';
end;
$$;

revoke all on function public.update_order_status(uuid, text) from anon, public;
grant execute on function public.update_order_status(uuid, text) to authenticated;

-- 3. Storage UPDATE with check (for those who already ran 000002 without it)
drop policy if exists "artworks_artist_update" on storage.objects;
create policy "artworks_artist_update"
on storage.objects for update
using (
  bucket_id = 'artworks'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_active_artist(auth.uid())
)
with check (
  bucket_id = 'artworks'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_active_artist(auth.uid())
);

-- Optional: reduce listing scope — public can only select objects in artworks bucket
-- (listing all buckets is already constrained by bucket policies)
