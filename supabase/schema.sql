-- Minimal auth columns required by this app.
-- Run in Supabase SQL editor.

alter table if exists public.users
  add column if not exists password text;

-- Keep usernames unique (case-insensitive behavior is handled in app by lowercasing).
create unique index if not exists users_username_unique_idx on public.users (username);
