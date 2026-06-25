-- ═══════════════════════════════════════════════════════
-- YSA Application – Supabase Schema (idempotent)
-- Run this in: Supabase Dashboard > SQL Editor
-- Safe to run multiple times on an existing project
-- ═══════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── PENDING MEMBERS ──────────────────────────────────────────────────────────
create table if not exists pending_members (
  id           uuid primary key default uuid_generate_v4(),
  first_name   text not null,
  last_name    text not null,
  email        text not null unique,
  password     text not null,
  phone        text,
  birthday     text,
  linkedin     text,
  role         text,
  station      text,
  memleket     text,
  igem_egitimi text,
  igem_tarihi  text,
  photo_url    text,
  created_at   timestamptz default now()
);
alter table pending_members enable row level security;

-- ── PROFILES ─────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id               uuid references auth.users(id) on delete cascade primary key,
  name             text not null,
  email            text not null,
  initial_password text,
  station          text not null default 'paris',
  role             text not null default 'Üye',
  phone            text,
  birthday         text,
  linkedin         text,
  memleket         text,
  photo_url        text,
  initials         text not null default '',
  igem_egitimi     text,
  igem_tarihi      text,
  created_at       timestamptz default now()
);
alter table profiles enable row level security;
drop policy if exists "Authenticated users can read profiles" on profiles;
drop policy if exists "Users can update own profile"          on profiles;
drop policy if exists "Service role can insert profiles"      on profiles;
create policy "Authenticated users can read profiles" on profiles for select to authenticated using (true);
create policy "Users can update own profile"          on profiles for update to authenticated using (auth.uid() = id);
create policy "Service role can insert profiles"      on profiles for insert to service_role with check (true);

-- ── POSTS ────────────────────────────────────────────────────────────────────
create table if not exists posts (
  id         uuid primary key default uuid_generate_v4(),
  author     text not null,
  initials   text not null,
  station    text not null,
  content    text not null,
  image_url  text,
  created_at timestamptz default now()
);
alter table posts enable row level security;
drop policy if exists "Authenticated can read posts"   on posts;
drop policy if exists "Authenticated can insert posts" on posts;
drop policy if exists "Authenticated can delete posts" on posts;
create policy "Authenticated can read posts"   on posts for select to authenticated using (true);
create policy "Authenticated can insert posts" on posts for insert to authenticated with check (true);
create policy "Authenticated can delete posts" on posts for delete to authenticated using (true);

-- ── POLLS ────────────────────────────────────────────────────────────────────
create table if not exists polls (
  id       uuid primary key default uuid_generate_v4(),
  post_id  uuid references posts(id) on delete cascade unique not null,
  question text not null
);
alter table polls enable row level security;
drop policy if exists "Authenticated can read polls"   on polls;
drop policy if exists "Authenticated can insert polls" on polls;
create policy "Authenticated can read polls"   on polls for select to authenticated using (true);
create policy "Authenticated can insert polls" on polls for insert to authenticated with check (true);

create table if not exists poll_options (
  id       text primary key,
  poll_id  uuid references polls(id) on delete cascade not null,
  text     text not null,
  position int not null default 0
);
alter table poll_options enable row level security;
drop policy if exists "Authenticated can read options"   on poll_options;
drop policy if exists "Authenticated can insert options" on poll_options;
create policy "Authenticated can read options"   on poll_options for select to authenticated using (true);
create policy "Authenticated can insert options" on poll_options for insert to authenticated with check (true);

create table if not exists poll_votes (
  option_id  text references poll_options(id) on delete cascade not null,
  voter_name text not null,
  primary key (option_id, voter_name)
);
alter table poll_votes enable row level security;
drop policy if exists "Authenticated can manage votes" on poll_votes;
create policy "Authenticated can manage votes" on poll_votes for all to authenticated using (true) with check (true);

-- ── MESSAGE POLLS ────────────────────────────────────────────────────────────
create table if not exists message_polls (
  id         uuid primary key default uuid_generate_v4(),
  message_id uuid references chat_messages(id) on delete cascade unique not null,
  question   text not null
);
alter table message_polls enable row level security;
drop policy if exists "Authenticated can read message_polls"   on message_polls;
drop policy if exists "Authenticated can insert message_polls" on message_polls;
create policy "Authenticated can read message_polls"   on message_polls for select to authenticated using (true);
create policy "Authenticated can insert message_polls" on message_polls for insert to authenticated with check (true);

create table if not exists message_poll_options (
  id       text primary key,
  poll_id  uuid references message_polls(id) on delete cascade not null,
  text     text not null,
  position int not null default 0
);
alter table message_poll_options enable row level security;
drop policy if exists "Authenticated can read message_poll_options"   on message_poll_options;
drop policy if exists "Authenticated can insert message_poll_options" on message_poll_options;
create policy "Authenticated can read message_poll_options"   on message_poll_options for select to authenticated using (true);
create policy "Authenticated can insert message_poll_options" on message_poll_options for insert to authenticated with check (true);

create table if not exists message_poll_votes (
  option_id  text references message_poll_options(id) on delete cascade not null,
  voter_name text not null,
  primary key (option_id, voter_name)
);
alter table message_poll_votes enable row level security;
drop policy if exists "Authenticated can manage message_poll_votes" on message_poll_votes;
create policy "Authenticated can manage message_poll_votes" on message_poll_votes for all to authenticated using (true) with check (true);

-- ── COMMENTS ─────────────────────────────────────────────────────────────────
create table if not exists post_comments (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid references posts(id) on delete cascade not null,
  author     text not null,
  initials   text not null,
  station    text not null,
  text       text not null,
  created_at timestamptz default now()
);
alter table post_comments enable row level security;
drop policy if exists "Authenticated can read comments"   on post_comments;
drop policy if exists "Authenticated can insert comments" on post_comments;
drop policy if exists "Authenticated can delete comments" on post_comments;
create policy "Authenticated can read comments"   on post_comments for select to authenticated using (true);
create policy "Authenticated can insert comments" on post_comments for insert to authenticated with check (true);
create policy "Authenticated can delete comments" on post_comments for delete to authenticated using (true);

-- ── LIKES ────────────────────────────────────────────────────────────────────
create table if not exists post_likes (
  post_id    uuid references posts(id) on delete cascade not null,
  voter_name text not null,
  primary key (post_id, voter_name)
);
alter table post_likes enable row level security;
drop policy if exists "Authenticated can manage likes" on post_likes;
create policy "Authenticated can manage likes" on post_likes for all to authenticated using (true) with check (true);

-- ── STORIES ──────────────────────────────────────────────────────────────────
create table if not exists stories (
  id                text primary key,
  station           text not null,
  author_name       text not null,
  initials          text not null,
  image_url         text not null,
  music_preview_url text,
  fit_mode          text default 'cover',
  created_at        timestamptz default now()
);
alter table stories enable row level security;
drop policy if exists "Authenticated can read stories"   on stories;
drop policy if exists "Authenticated can insert stories" on stories;
drop policy if exists "Authenticated can delete stories" on stories;
create policy "Authenticated can read stories"   on stories for select to authenticated using (true);
create policy "Authenticated can insert stories" on stories for insert to authenticated with check (true);
create policy "Authenticated can delete stories" on stories for delete to authenticated using (true);

-- ── TASKS ────────────────────────────────────────────────────────────────────
create table if not exists tasks (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  description text,
  status      text not null default 'todo',
  priority    text not null default 'normal',
  station     text not null,
  assignee    text,
  due_date    text,
  created_at  timestamptz default now()
);
alter table tasks enable row level security;
drop policy if exists "Authenticated can read tasks"   on tasks;
drop policy if exists "Authenticated can manage tasks" on tasks;
create policy "Authenticated can read tasks"   on tasks for select to authenticated using (true);
create policy "Authenticated can manage tasks" on tasks for all    to authenticated using (true) with check (true);

-- ── IGEM REQUESTS ────────────────────────────────────────────────────────────
create table if not exists igem_requests (
  id         uuid primary key default uuid_generate_v4(),
  author     text not null,
  initials   text not null,
  station    text not null,
  motivation text,
  created_at timestamptz default now()
);
alter table igem_requests enable row level security;
drop policy if exists "Authenticated can read igem"   on igem_requests;
drop policy if exists "Authenticated can insert igem" on igem_requests;
create policy "Authenticated can read igem"   on igem_requests for select to authenticated using (true);
create policy "Authenticated can insert igem" on igem_requests for insert to authenticated with check (true);

-- ── EVENTS ───────────────────────────────────────────────────────────────────
create table if not exists events (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  date        date,
  time        text,
  place       text,
  station     text,
  description text,
  link        text,
  end_date    date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);
alter table events enable row level security;
drop policy if exists "events_select_all" on events;
drop policy if exists "events_insert_all" on events;
drop policy if exists "events_update_own" on events;
drop policy if exists "events_delete_own" on events;
drop policy if exists "events_delete_all" on events;
create policy "events_select_all" on events for select to authenticated using (true);
create policy "events_insert_all" on events for insert to authenticated with check (true);
create policy "events_update_own" on events for update to authenticated using (created_by = auth.uid()) with check (true);
create policy "events_delete_own" on events for delete to authenticated using (created_by = auth.uid());

-- ── TASK COMMENTS ────────────────────────────────────────────────────────────
create table if not exists task_comments (
  id         uuid primary key default uuid_generate_v4(),
  task_id    uuid references tasks(id) on delete cascade not null,
  author     text not null,
  initials   text not null default '',
  text       text not null,
  created_at timestamptz default now()
);
alter table task_comments enable row level security;
drop policy if exists "Authenticated can read task_comments"   on task_comments;
drop policy if exists "Authenticated can insert task_comments" on task_comments;
create policy "Authenticated can read task_comments"   on task_comments for select to authenticated using (true);
create policy "Authenticated can insert task_comments" on task_comments for insert to authenticated with check (true);

-- ── MIGRATIONS — colonnes ajoutées après la création initiale ────────────────
-- Ces commandes sont idempotentes (ADD COLUMN IF NOT EXISTS).
-- À exécuter dans : Supabase Dashboard > SQL Editor
alter table pending_members add column if not exists phone        text;
alter table pending_members add column if not exists birthday     text;
alter table pending_members add column if not exists linkedin     text;
alter table pending_members add column if not exists role         text;
alter table pending_members add column if not exists station      text;
alter table pending_members add column if not exists memleket     text;
alter table pending_members add column if not exists igem_egitimi text;
alter table pending_members add column if not exists igem_tarihi  text;
alter table pending_members add column if not exists photo_url    text;

alter table profiles add column if not exists name             text not null default '';
alter table profiles add column if not exists email            text not null default '';
alter table profiles add column if not exists station          text not null default 'paris';
alter table profiles add column if not exists role             text not null default 'Üye';
alter table profiles add column if not exists initials         text not null default '';
alter table profiles add column if not exists phone            text;
alter table profiles add column if not exists birthday         text;
alter table profiles add column if not exists linkedin         text;
alter table profiles add column if not exists memleket         text;
alter table profiles add column if not exists photo_url        text;
alter table profiles add column if not exists igem_egitimi     text;
alter table profiles add column if not exists igem_tarihi      text;
alter table profiles add column if not exists initial_password text;

-- Tasks — colonnes ajoutées
alter table tasks add column if not exists assignee_initials    text;
alter table tasks add column if not exists assigned_by          text;
alter table tasks add column if not exists assigned_by_initials text;
alter table tasks add column if not exists assigned_by_station  text;
alter table tasks add column if not exists created_by           uuid references auth.users(id) on delete set null;
alter table tasks add column if not exists due_date             text;

-- Copier full_name → name et email depuis auth.users pour les profils existants
update profiles p
set
  email    = coalesce((select u.email from auth.users u where u.id = p.id), ''),
  name     = coalesce(p.full_name, ''),
  initials = case
    when p.full_name is not null and trim(p.full_name) != ''
    then upper(left(split_part(trim(p.full_name),' ',1),1) || left(split_part(trim(p.full_name),' ',2),1))
    else '?'
  end
where name = '' or email = '';

-- ── CONVERSATIONS (messagerie) ────────────────────────────────────────────────
create table if not exists conversations (
  id         uuid primary key default uuid_generate_v4(),
  type       text not null check (type in ('group', 'dm')),
  name       text,
  initials   text,
  admin_name text,
  created_at timestamptz default now()
);
alter table conversations add column if not exists admin_name text;
alter table conversations enable row level security;
drop policy if exists "Authenticated can read conversations"   on conversations;
drop policy if exists "Authenticated can insert conversations" on conversations;
drop policy if exists "Authenticated can delete conversations" on conversations;
create policy "Authenticated can read conversations"   on conversations for select to authenticated using (true);
create policy "Authenticated can insert conversations" on conversations for insert to authenticated with check (true);
create policy "Authenticated can update conversations" on conversations for update to authenticated using (true) with check (true);
create policy "Authenticated can delete conversations" on conversations for delete to authenticated using (true);

-- ── CONVERSATION MEMBERS ─────────────────────────────────────────────────────
create table if not exists conversation_members (
  conversation_id uuid references conversations(id) on delete cascade not null,
  member_name     text not null,
  is_admin        boolean not null default false,
  primary key (conversation_id, member_name)
);
alter table conversation_members add column if not exists is_admin boolean not null default false;
alter table conversation_members enable row level security;
drop policy if exists "Authenticated can manage conv members" on conversation_members;
create policy "Authenticated can manage conv members" on conversation_members for all to authenticated using (true) with check (true);

-- ── CHAT MESSAGES ─────────────────────────────────────────────────────────────
create table if not exists chat_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_name     text not null,
  sender_initials text not null,
  text            text,
  image_url       text,
  is_system       boolean default false,
  created_at      timestamptz default now()
);
alter table chat_messages enable row level security;
drop policy if exists "Authenticated can read chat messages"   on chat_messages;
drop policy if exists "Authenticated can insert chat messages" on chat_messages;
create policy "Authenticated can read chat messages"   on chat_messages for select to authenticated using (true);
create policy "Authenticated can insert chat messages" on chat_messages for insert to authenticated with check (true);

-- Posts — created_by pour identifier l'auteur par UUID (fix bug noms dupliqués)
alter table posts add column if not exists created_by uuid references auth.users(id) on delete set null;

-- iGEM requests — created_by + delete policy
alter table igem_requests add column if not exists created_by uuid references auth.users(id) on delete set null;
drop policy if exists "Authenticated can delete own igem" on igem_requests;
create policy "Authenticated can delete own igem" on igem_requests for delete to authenticated using (created_by = auth.uid());

-- iGEM comments
create table if not exists igem_comments (
  id         uuid primary key default uuid_generate_v4(),
  igem_id    uuid references igem_requests(id) on delete cascade not null,
  author     text not null,
  initials   text not null,
  station    text not null,
  text       text not null,
  created_at timestamptz default now()
);
alter table igem_comments enable row level security;
drop policy if exists "Authenticated can read igem_comments"   on igem_comments;
drop policy if exists "Authenticated can insert igem_comments" on igem_comments;
create policy "Authenticated can read igem_comments"   on igem_comments for select to authenticated using (true);
create policy "Authenticated can insert igem_comments" on igem_comments for insert to authenticated with check (true);

-- Stories — music label (nom + artiste affiché dans le viewer)
alter table stories add column if not exists music_label text;

-- ── STORAGE: chat-images bucket ───────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', true, 5242880, '{image/jpeg,image/png,image/webp,image/gif}')
on conflict (id) do nothing;

drop policy if exists "Public read chat images"          on storage.objects;
drop policy if exists "Auth users upload chat images"    on storage.objects;
drop policy if exists "Auth users delete own chat image" on storage.objects;

create policy "Public read chat images"
  on storage.objects for select to public
  using (bucket_id = 'chat-images');

create policy "Auth users upload chat images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images');

create policy "Auth users delete own chat image"
  on storage.objects for delete to authenticated
  using (bucket_id = 'chat-images');

-- ── EVENTS — colonnes ajoutées si table créée avant le schema complet ────────
-- À exécuter si erreur "Could not find column ... in schema cache"
-- Puis : Supabase Dashboard > Settings > API > Reload schema cache
alter table events add column if not exists time        text;
alter table events add column if not exists place       text;
alter table events add column if not exists station     text;
alter table events add column if not exists description text;
alter table events add column if not exists link        text;
alter table events add column if not exists created_by  uuid references auth.users(id) on delete set null;
alter table events add column if not exists created_at  timestamptz default now();

-- ── STORY REACTIONS ────────────────────────────────────────────────────────────
create table if not exists story_reactions (
  story_id  text not null,
  user_name text not null,
  primary key (story_id, user_name)
);
alter table story_reactions enable row level security;
drop policy if exists "Authenticated can read story_reactions"   on story_reactions;
drop policy if exists "Authenticated can insert story_reactions" on story_reactions;
drop policy if exists "Authenticated can delete story_reactions" on story_reactions;
create policy "Authenticated can read story_reactions"   on story_reactions for select to authenticated using (true);
create policy "Authenticated can insert story_reactions" on story_reactions for insert to authenticated with check (true);
create policy "Authenticated can delete story_reactions" on story_reactions for delete to authenticated using (true);
