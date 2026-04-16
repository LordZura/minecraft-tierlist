-- This project is intentionally configured without RLS policies.
-- Run this after schema.sql if needed.

alter table if exists public.users disable row level security;
alter table if exists public.fight_logs disable row level security;
alter table if exists public.challenges disable row level security;
alter table if exists public.challenge_matches disable row level security;
alter table if exists public.notifications disable row level security;
alter table if exists public.admin_logs disable row level security;
alter table if exists public.user_admin_overrides disable row level security;
