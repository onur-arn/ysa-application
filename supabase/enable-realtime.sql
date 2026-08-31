-- Enable Supabase Realtime for chat (SQL Editor → Run)
-- Free plan includes Realtime — no purchase needed.
-- Ignore errors like "already member of publication".

do $$
begin
  alter publication supabase_realtime add table chat_messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table conversation_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table conversations;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table call_sessions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table call_signals;
exception when duplicate_object then null;
end $$;
