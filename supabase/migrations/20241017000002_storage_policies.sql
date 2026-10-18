-- Storage: create bucket "artworks" in Dashboard first
-- Settings: Public bucket, 5 MB limit, allowed MIME: image/jpeg, image/png, image/webp, image/avif
--
-- Then run the following in SQL Editor:

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artworks',
  'artworks',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read
drop policy if exists "artworks_public_read" on storage.objects;
create policy "artworks_public_read"
on storage.objects for select
using (bucket_id = 'artworks');

-- Active artists: insert only into their folder {uid}/...
drop policy if exists "artworks_artist_insert" on storage.objects;
create policy "artworks_artist_insert"
on storage.objects for insert
with check (
  bucket_id = 'artworks'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_active_artist(auth.uid())
);

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

drop policy if exists "artworks_artist_delete" on storage.objects;
create policy "artworks_artist_delete"
on storage.objects for delete
using (
  bucket_id = 'artworks'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_active_artist(auth.uid())
);
