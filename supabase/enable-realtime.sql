-- Enable Supabase Realtime for live cross-device sync
-- Run in: Supabase Dashboard → SQL Editor
-- Ignore "already member of publication" errors.

do $$ begin alter publication supabase_realtime add table chat_messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table conversation_members; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table conversations; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table call_sessions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table call_signals; exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table posts; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table post_comments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table post_likes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table polls; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table poll_votes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table poll_options; exception when duplicate_object then null; end $$;

-- DELETE payloads need full rows for composite keys / FKs
alter table poll_votes replica identity full;
alter table post_likes replica identity full;
alter table post_comments replica identity full;
alter table message_poll_votes replica identity full;

do $$ begin alter publication supabase_realtime add table stories; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table story_reactions; exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table igem_requests; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table igem_comments; exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table events; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table tasks; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table task_comments; exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table profiles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table pending_members; exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table message_polls; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table message_poll_votes; exception when duplicate_object then null; end $$;
