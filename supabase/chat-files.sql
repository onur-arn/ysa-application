-- Chat documents (PDF, Word, Excel, etc.)
alter table chat_messages add column if not exists file_url text;
alter table chat_messages add column if not exists file_name text;
alter table chat_messages add column if not exists file_mime text;
alter table chat_messages add column if not exists file_size integer;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-files',
  'chat-files',
  true,
  20971520,
  '{application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip,application/x-zip-compressed,image/jpeg,image/png}'
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read chat files" on storage.objects;
drop policy if exists "Auth users upload chat files" on storage.objects;
drop policy if exists "Auth users delete own chat files" on storage.objects;

create policy "Public read chat files"
  on storage.objects for select to public
  using (bucket_id = 'chat-files');

create policy "Auth users upload chat files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-files');

create policy "Auth users delete own chat files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'chat-files');
