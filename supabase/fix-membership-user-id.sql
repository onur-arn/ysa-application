-- Run in Supabase → SQL Editor (project linked to youthstation)
-- Restores conversation list + group membership persistence.

alter table conversation_members
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists conversation_members_user_id_idx
  on conversation_members(user_id);

update conversation_members cm
set user_id = p.id
from profiles p
where cm.user_id is null and p.name = cm.member_name;

alter table chat_messages add column if not exists audio_url text;
alter table chat_messages add column if not exists gif_url text;
alter table chat_messages add column if not exists message_type text default 'text';
