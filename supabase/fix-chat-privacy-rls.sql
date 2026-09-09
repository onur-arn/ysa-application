-- Chat privacy: only conversation members (and platform admins) see messages.
-- Realtime postgres_changes respects SELECT RLS — this stops notifying outsiders.
-- Run in Supabase Dashboard → SQL Editor.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and lower(trim(p.email)) in (
        'secretaire@youthstation.org',
        'president@youthstation.org',
        'feyza.simsek09@gmail.com'
      )
  );
$$;

create or replace function public.is_conversation_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from conversation_members cm
    where cm.conversation_id = cid
      and (
        cm.user_id = auth.uid()
        or cm.member_name = (select p.name from profiles p where p.id = auth.uid() limit 1)
      )
  );
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_conversation_member(uuid) to authenticated;

-- ── chat_messages (critical for Realtime privacy) ────────────────────────────
drop policy if exists "Authenticated can read chat messages" on chat_messages;
drop policy if exists "Authenticated can insert chat messages" on chat_messages;
drop policy if exists "Members read own chat messages" on chat_messages;
drop policy if exists "Members insert own chat messages" on chat_messages;

create policy "Members read own chat messages"
  on chat_messages for select to authenticated
  using (public.is_platform_admin() or public.is_conversation_member(conversation_id));

create policy "Members insert own chat messages"
  on chat_messages for insert to authenticated
  with check (public.is_platform_admin() or public.is_conversation_member(conversation_id));

-- ── conversation_members ─────────────────────────────────────────────────────
drop policy if exists "Authenticated can manage conv members" on conversation_members;
drop policy if exists "Members read own conv members" on conversation_members;
drop policy if exists "Members insert conv members" on conversation_members;
drop policy if exists "Members update conv members" on conversation_members;
drop policy if exists "Members delete conv members" on conversation_members;

create policy "Members read own conv members"
  on conversation_members for select to authenticated
  using (
    public.is_platform_admin()
    or user_id = auth.uid()
    or member_name = (select p.name from profiles p where p.id = auth.uid() limit 1)
    or public.is_conversation_member(conversation_id)
  );

-- Allow: self, existing members adding people, or first members of a brand-new empty conv
create policy "Members insert conv members"
  on conversation_members for insert to authenticated
  with check (
    public.is_platform_admin()
    or user_id = auth.uid()
    or member_name = (select p.name from profiles p where p.id = auth.uid() limit 1)
    or public.is_conversation_member(conversation_id)
    or not exists (
      select 1 from conversation_members cm where cm.conversation_id = conversation_id
    )
  );

create policy "Members update conv members"
  on conversation_members for update to authenticated
  using (public.is_platform_admin() or public.is_conversation_member(conversation_id))
  with check (public.is_platform_admin() or public.is_conversation_member(conversation_id));

create policy "Members delete conv members"
  on conversation_members for delete to authenticated
  using (public.is_platform_admin() or public.is_conversation_member(conversation_id));

-- ── conversations ────────────────────────────────────────────────────────────
drop policy if exists "Authenticated can read conversations" on conversations;
drop policy if exists "Members read own conversations" on conversations;

create policy "Members read own conversations"
  on conversations for select to authenticated
  using (
    public.is_platform_admin()
    or public.is_conversation_member(id)
    or not exists (
      select 1 from conversation_members cm where cm.conversation_id = conversations.id
    )
  );
