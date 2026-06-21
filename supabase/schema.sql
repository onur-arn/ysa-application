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
