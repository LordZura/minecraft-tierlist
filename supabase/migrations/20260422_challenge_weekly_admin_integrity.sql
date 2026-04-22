-- Adds challenge type locking, round-based challenge scores,
-- admin override audit history, and weekly required PvP cycle support.

alter table public.challenges
  add column if not exists pvp_type text;

update public.challenges c
set pvp_type = coalesce(
  (
    select cm.pvp_type
    from public.challenge_matches cm
    where cm.challenge_id = c.id
    order by cm.match_number asc
    limit 1
  ),
  'sword'
)
where c.pvp_type is null;

alter table public.challenges
  alter column pvp_type set default 'sword',
  alter column pvp_type set not null;

do $$ begin
  alter table public.challenges add constraint challenges_pvp_type_chk check (pvp_type in ('crystal','sword','axe','uhc','manhunt','mace','smp','cart','bow'));
exception when duplicate_object then null; end $$;

alter table public.challenge_matches
  add column if not exists challenger_round_wins integer,
  add column if not exists challenged_round_wins integer;

update public.challenge_matches cm
set challenger_round_wins = case when cm.winner = c.challenger then 1 else 0 end,
    challenged_round_wins = case when cm.winner = c.challenged then 1 else 0 end
from public.challenges c
where c.id = cm.challenge_id
  and (cm.challenger_round_wins is null or cm.challenged_round_wins is null);

alter table public.challenge_matches
  alter column challenger_round_wins set default 1,
  alter column challenged_round_wins set default 0,
  alter column challenger_round_wins set not null,
  alter column challenged_round_wins set not null;

do $$ begin
  alter table public.challenge_matches add constraint challenge_matches_round_wins_chk check (
    challenger_round_wins >= 0 and challenged_round_wins >= 0 and challenger_round_wins <= 10 and challenged_round_wins <= 10
  );
exception when duplicate_object then null; end $$;

create table if not exists public.admin_override_history (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  previous_values jsonb not null,
  new_values jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists admin_override_history_user_idx on public.admin_override_history(user_id, created_at desc);

create table if not exists public.weekly_pvp_cycles (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'active',
  penalties_applied boolean not null default false,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  constraint weekly_pvp_cycles_status_chk check (status in ('active', 'completed')),
  constraint weekly_pvp_cycles_range_chk check (end_at > start_at)
);

create unique index if not exists weekly_pvp_active_unique on public.weekly_pvp_cycles(status) where status = 'active';

create table if not exists public.weekly_cycle_requirements (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.weekly_pvp_cycles(id) on delete cascade,
  pvp_type text not null,
  rounds_required integer not null default 3,
  created_at timestamptz not null default now(),
  constraint weekly_cycle_requirements_type_chk check (pvp_type in ('crystal','sword','axe','uhc','manhunt','mace','smp','cart','bow')),
  constraint weekly_cycle_requirements_rounds_chk check (rounds_required between 1 and 10),
  unique (cycle_id, pvp_type)
);

create table if not exists public.weekly_assignments (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.weekly_pvp_cycles(id) on delete cascade,
  pvp_type text not null,
  player_a uuid not null references public.users(id) on delete cascade,
  player_b uuid references public.users(id) on delete cascade,
  ready_a_at timestamptz,
  ready_b_at timestamptz,
  ready_deadline_at timestamptz not null,
  status text not null default 'assigned',
  winner uuid references public.users(id) on delete set null,
  win_reason text,
  rounds_a integer,
  rounds_b integer,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint weekly_assignments_type_chk check (pvp_type in ('crystal','sword','axe','uhc','manhunt','mace','smp','cart','bow')),
  constraint weekly_assignments_status_chk check (status in ('assigned','ready','played','default_win','no_show','expired_both_unready')),
  constraint weekly_assignments_distinct_chk check (player_b is null or player_a <> player_b),
  constraint weekly_assignments_rounds_chk check (
    (rounds_a is null and rounds_b is null)
    or (rounds_a is not null and rounds_b is not null and rounds_a >= 0 and rounds_b >= 0 and rounds_a <= 10 and rounds_b <= 10)
  )
);

create index if not exists weekly_assignments_cycle_idx on public.weekly_assignments(cycle_id, pvp_type);
create index if not exists weekly_assignments_player_a_idx on public.weekly_assignments(player_a, created_at desc);
create index if not exists weekly_assignments_player_b_idx on public.weekly_assignments(player_b, created_at desc);

create table if not exists public.elo_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pvp_type text not null,
  delta integer not null,
  reason text not null,
  cycle_id uuid references public.weekly_pvp_cycles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint elo_adjustments_type_chk check (pvp_type in ('crystal','sword','axe','uhc','manhunt','mace','smp','cart','bow')),
  unique (user_id, pvp_type, cycle_id, reason)
);
