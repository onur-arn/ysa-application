-- Votes & likes must be visible to all authenticated users (counts / names).
-- Writes stay limited to the current user's own name.
-- Run in: Supabase Dashboard → SQL Editor (project cwkjrikbaiiwmdifihvp)

-- ── post_likes ───────────────────────────────────────────────────────────────
drop policy if exists "Authenticated can manage likes" on post_likes;
drop policy if exists "Users manage own likes" on post_likes;
drop policy if exists "Users read likes" on post_likes;
drop policy if exists "Users insert own likes" on post_likes;
drop policy if exists "Users delete own likes" on post_likes;
drop policy if exists "Select post_likes" on post_likes;
drop policy if exists "Insert post_likes" on post_likes;
drop policy if exists "Delete post_likes" on post_likes;

create policy "Anyone authenticated can read likes"
  on post_likes for select to authenticated
  using (true);

create policy "Users insert own likes"
  on post_likes for insert to authenticated
  with check (
    voter_name = (select p.name from profiles p where p.id = auth.uid() limit 1)
  );

create policy "Users delete own likes"
  on post_likes for delete to authenticated
  using (
    voter_name = (select p.name from profiles p where p.id = auth.uid() limit 1)
  );

-- ── poll_votes (anasayfa) ────────────────────────────────────────────────────
drop policy if exists "Authenticated can manage votes" on poll_votes;
drop policy if exists "Users manage own votes" on poll_votes;
drop policy if exists "Users read votes" on poll_votes;
drop policy if exists "Users insert own votes" on poll_votes;
drop policy if exists "Users delete own votes" on poll_votes;
drop policy if exists "Select poll_votes" on poll_votes;
drop policy if exists "Insert poll_votes" on poll_votes;
drop policy if exists "Delete poll_votes" on poll_votes;

create policy "Anyone authenticated can read poll votes"
  on poll_votes for select to authenticated
  using (true);

create policy "Users insert own poll votes"
  on poll_votes for insert to authenticated
  with check (
    voter_name = (select p.name from profiles p where p.id = auth.uid() limit 1)
  );

create policy "Users delete own poll votes"
  on poll_votes for delete to authenticated
  using (
    voter_name = (select p.name from profiles p where p.id = auth.uid() limit 1)
  );

-- ── message_poll_votes (DM / groups) ─────────────────────────────────────────
drop policy if exists "Authenticated can manage message_poll_votes" on message_poll_votes;
drop policy if exists "Users manage own message_poll_votes" on message_poll_votes;
drop policy if exists "Users read message_poll_votes" on message_poll_votes;
drop policy if exists "Users insert own message_poll_votes" on message_poll_votes;
drop policy if exists "Users delete own message_poll_votes" on message_poll_votes;
drop policy if exists "Select message_poll_votes" on message_poll_votes;
drop policy if exists "Insert message_poll_votes" on message_poll_votes;
drop policy if exists "Delete message_poll_votes" on message_poll_votes;

create policy "Anyone authenticated can read message poll votes"
  on message_poll_votes for select to authenticated
  using (true);

create policy "Users insert own message poll votes"
  on message_poll_votes for insert to authenticated
  with check (
    voter_name = (select p.name from profiles p where p.id = auth.uid() limit 1)
  );

create policy "Users delete own message poll votes"
  on message_poll_votes for delete to authenticated
  using (
    voter_name = (select p.name from profiles p where p.id = auth.uid() limit 1)
  );
