-- Optional: persist group avatar URL on conversations (app also uses storage path fallback).
alter table conversations add column if not exists avatar_url text;
