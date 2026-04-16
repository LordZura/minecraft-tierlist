-- Full reset + bootstrap for this project.
-- Run this in Supabase SQL editor as a single script.
-- It is designed to recover from messy/random existing objects.

create extension if not exists pgcrypto;

-- Drop existing views in public schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT viewname
    FROM pg_views
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('drop view if exists public.%I cascade;', r.viewname);
  END LOOP;
END $$;

-- Drop existing tables in public schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('drop table if exists public.%I cascade;', r.tablename);
  END LOOP;
END $$;

-- USERS
create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_username_format_chk check (username ~ '^[a-z0-9_]{3,32}$')
);

create index users_created_at_idx on public.users(created_at desc);

-- FIGHT LOGS
create table public.fight_logs (
  id uuid primary key default gen_random_uuid(),
  player1 uuid not null references public.users(id) on delete cascade,
  player2 uuid not null references public.users(id) on delete cascade,
  winner uuid not null references public.users(id) on delete cascade,
  pvp_type text not null,
  score text,
  is_confirmed boolean not null default false,
  rejected boolean not null default false,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint fight_logs_players_distinct_chk check (player1 <> player2),
  constraint fight_logs_winner_participant_chk check (winner = player1 or winner = player2),
  constraint fight_logs_pvp_type_chk check (pvp_type in ('crystal','sword','axe','uhc','manhunt','mace','smp','cart','bow'))
);

create index fight_logs_player1_idx on public.fight_logs(player1);
create index fight_logs_player2_idx on public.fight_logs(player2);
create index fight_logs_created_at_idx on public.fight_logs(created_at desc);
create index fight_logs_confirmed_idx on public.fight_logs(is_confirmed, rejected);

-- CHALLENGES
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references public.users(id) on delete cascade,
  challenged uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending',
  winner uuid references public.users(id) on delete set null,
  challenger_wins integer not null default 0,
  challenged_wins integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint challenges_players_distinct_chk check (challenger <> challenged),
  constraint challenges_status_chk check (status in ('pending','accepted','rejected','completed')),
  constraint challenges_win_counts_chk check (challenger_wins >= 0 and challenged_wins >= 0 and challenger_wins <= 10 and challenged_wins <= 10),
  constraint challenges_completed_winner_chk check (
    (status <> 'completed')
    or (winner is not null and (winner = challenger or winner = challenged))
  )
);

create index challenges_challenger_idx on public.challenges(challenger);
create index challenges_challenged_idx on public.challenges(challenged);
create index challenges_status_idx on public.challenges(status);
create index challenges_created_at_idx on public.challenges(created_at desc);

-- CHALLENGE MATCHES
create table public.challenge_matches (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  match_number integer not null,
  winner uuid not null references public.users(id) on delete cascade,
  pvp_type text not null,
  score text,
  created_at timestamptz not null default now(),
  constraint challenge_matches_match_number_chk check (match_number between 1 and 10),
  constraint challenge_matches_pvp_type_chk check (pvp_type in ('crystal','sword','axe','uhc','manhunt','mace','smp','cart','bow')),
  unique (challenge_id, match_number)
);

create index challenge_matches_challenge_idx on public.challenge_matches(challenge_id);
create index challenge_matches_winner_idx on public.challenge_matches(winner);
create index challenge_matches_created_at_idx on public.challenge_matches(created_at desc);

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  related_id uuid,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_read_idx on public.notifications(user_id, read);

-- ADMIN LOGS
create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index admin_logs_admin_idx on public.admin_logs(admin_id, created_at desc);

-- ADMIN OVERRIDES (manual stat/elo control)
create table public.user_admin_overrides (
  user_id uuid primary key references public.users(id) on delete cascade,
  total_points_override integer,
  total_wins_override integer,
  total_losses_override integer,
  elo_overall_override integer,
  elo_average_override integer,
  elo_crystal_override integer,
  elo_sword_override integer,
  elo_axe_override integer,
  elo_uhc_override integer,
  elo_manhunt_override integer,
  elo_mace_override integer,
  elo_smp_override integer,
  elo_cart_override integer,
  elo_bow_override integer,
  updated_at timestamptz not null default now()
);

-- Auto-updated timestamps for users
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

-- LEADERBOARD view used by profile page.
create or replace view public.leaderboard as
with fight_summary as (
  select
    u.id,
    coalesce(sum(case when f.is_confirmed = true and f.rejected = false and f.winner = u.id then 1 else 0 end), 0) as fight_wins,
    coalesce(sum(case when f.is_confirmed = true and f.rejected = false and f.winner <> u.id and (f.player1 = u.id or f.player2 = u.id) then 1 else 0 end), 0) as fight_losses
  from public.users u
  left join public.fight_logs f
    on f.player1 = u.id or f.player2 = u.id
  group by u.id
),
challenge_summary as (
  select
    u.id,
    coalesce(sum(case when c.status = 'completed' and c.winner = u.id then 1 else 0 end), 0) as challenge_wins,
    coalesce(sum(case when c.status = 'completed' and c.winner is not null and c.winner <> u.id and (c.challenger = u.id or c.challenged = u.id) then 1 else 0 end), 0) as challenge_losses
  from public.users u
  left join public.challenges c
    on c.challenger = u.id or c.challenged = u.id
  group by u.id
),
base as (
  select
    u.id,
    u.username,
    fs.fight_wins,
    fs.fight_losses,
    cs.challenge_wins,
    cs.challenge_losses,
    (fs.fight_wins + cs.challenge_wins) as total_wins,
    (fs.fight_losses + cs.challenge_losses) as total_losses,
    (fs.fight_wins * 10 + fs.fight_losses * -5 + cs.challenge_wins * 20 + cs.challenge_losses * -10) as total_points
  from public.users u
  join fight_summary fs on fs.id = u.id
  join challenge_summary cs on cs.id = u.id
)
select
  row_number() over (order by total_points desc, total_wins desc, username asc) as rank,
  id,
  username,
  total_points,
  total_wins,
  total_losses,
  fight_wins,
  fight_losses,
  challenge_wins,
  challenge_losses
from base;

-- OPEN/UNRESTRICTED: disable row-level security everywhere.
alter table public.users disable row level security;
alter table public.fight_logs disable row level security;
alter table public.challenges disable row level security;
alter table public.challenge_matches disable row level security;
alter table public.notifications disable row level security;
alter table public.admin_logs disable row level security;
alter table public.user_admin_overrides disable row level security;
