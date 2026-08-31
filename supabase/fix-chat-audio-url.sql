-- Run in Supabase → SQL Editor (project cwkjrikbaiiwmdifihvp)
-- Fixes chat history disappearing: app was selecting a missing column.

alter table chat_messages add column if not exists audio_url text;
alter table chat_messages add column if not exists gif_url text;
alter table chat_messages add column if not exists message_type text default 'text';
