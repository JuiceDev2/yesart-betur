-- =============================================================================
-- Aura — 005 almacenamiento (buckets + políticas) y mantenimiento
--  avatars : público  (fotos de perfil y portadas)
--  media   : PRIVADO  (contenido; solo se firma URL si can_view_post lo permite)
--  kyc     : PRIVADO  (documentos de verificación; solo los ve un administrador)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('media', 'media', false, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
          'video/mp4', 'video/webm', 'video/quicktime']),
  ('kyc', 'kyc', false, 8388608,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ¿puede el usuario actual ver este archivo de "media"? (ruta: {creador}/{publicación}/{archivo})
create or replace function public.can_view_media(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_view_post(public.safe_uuid(split_part(p_name, '/', 2)));
$$;

-- avatars ---------------------------------------------------------------------
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');
create policy avatars_insert on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated'
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- media -----------------------------------------------------------------------
create policy media_read on storage.objects for select
  using (bucket_id = 'media' and public.can_view_media(name));
create policy media_insert on storage.objects for insert
  with check (bucket_id = 'media' and auth.role() = 'authenticated'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.me_creator());
create policy media_delete on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- kyc -------------------------------------------------------------------------
create policy kyc_read_admin on storage.objects for select
  using (bucket_id = 'kyc' and public.is_admin());
create policy kyc_insert on storage.objects for insert
  with check (bucket_id = 'kyc' and auth.role() = 'authenticated'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.me_adult());
create policy kyc_delete_own on storage.objects for delete
  using (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- Mantenimiento (cron, solo service role)
-- -----------------------------------------------------------------------------
create or replace function public.cleanup_rate_events()
returns void language sql security definer set search_path = '' as $$
  delete from public.rate_events where created_at < now() - interval '2 days';
$$;

create or replace function public.cleanup_old_audit(p_days int default 365)
returns void language sql security definer set search_path = '' as $$
  delete from public.audit_log where created_at < now() - make_interval(days => p_days);
$$;

-- El acceso se calcula por fecha, pero conviene reflejar el estado real en la UI.
create or replace function public.expire_subscriptions()
returns int language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  update public.subscriptions set status = 'expired'
  where status in ('active', 'canceled', 'past_due')
    and current_period_end <= now() - interval '3 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Archivos de "media" que ningún post_media referencia (subidas abandonadas)
create or replace function public.orphan_media_paths(p_hours int default 24)
returns setof text language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'media'
    and o.created_at < now() - make_interval(hours => p_hours)
    and not exists (select 1 from public.post_media m where m.path = o.name)
  limit 200;
$$;

-- Documentos de verificación ya resueltos hace más de N días
create or replace function public.kyc_to_purge(p_days int default 30)
returns table (app_id uuid, paths text[])
language sql stable security definer set search_path = '' as $$
  select a.id, array_remove(array[a.id_doc_path, a.selfie_path], null)
  from public.creator_applications a
  where a.status <> 'pending' and a.kyc_purged_at is null
    and a.reviewed_at < now() - make_interval(days => p_days)
  limit 100;
$$;

create or replace function public.mark_kyc_purged(p_app_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.creator_applications
    set kyc_purged_at = now(), id_doc_path = null, selfie_path = null
  where id = any (p_app_ids);
$$;

-- Verificación automática: ninguna tabla del esquema public sin RLS
create or replace function public.tables_without_rls()
returns setof text language sql stable security definer set search_path = '' as $$
  select c.relname::text from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.cleanup_rate_events()', 'public.cleanup_old_audit(int)', 'public.expire_subscriptions()',
    'public.orphan_media_paths(int)', 'public.kyc_to_purge(int)', 'public.mark_kyc_purged(uuid[])',
    'public.tables_without_rls()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
