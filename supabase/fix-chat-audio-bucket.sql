-- Ensure chat-audio bucket accepts voice note MIME types (no codecs suffix needed).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-audio',
  'chat-audio',
  true,
  10485760,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/aac', 'application/octet-stream']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read
drop policy if exists "chat-audio public read" on storage.objects;
create policy "chat-audio public read"
  on storage.objects for select
  using (bucket_id = 'chat-audio');

-- Authenticated upload (API uses service role; this helps client fallback)
drop policy if exists "chat-audio auth upload" on storage.objects;
create policy "chat-audio auth upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-audio');

drop policy if exists "chat-audio auth update" on storage.objects;
create policy "chat-audio auth update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'chat-audio');
