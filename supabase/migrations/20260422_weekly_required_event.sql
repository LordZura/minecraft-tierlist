alter table public.weekly_pvp_cycles
  add column if not exists selected_pvp_types text[];

update public.weekly_pvp_cycles
set selected_pvp_types = array['crystal','sword','axe']
where selected_pvp_types is null;

alter table public.weekly_pvp_cycles
  alter column selected_pvp_types set not null;

alter table public.weekly_pvp_cycles
  drop constraint if exists weekly_pvp_cycles_status_chk;
alter table public.weekly_pvp_cycles
  add constraint weekly_pvp_cycles_status_chk check (status in ('upcoming','active','completed'));

alter table public.weekly_pvp_cycles
  drop constraint if exists weekly_pvp_cycles_types_chk;
alter table public.weekly_pvp_cycles
  add constraint weekly_pvp_cycles_types_chk check (array_length(selected_pvp_types, 1) = 3);

alter table public.weekly_pvp_assignments
  add column if not exists round_number integer not null default 1,
  add column if not exists ready_by_at timestamptz;

alter table public.weekly_pvp_assignments
  drop column if exists ready_deadline_at,
  drop column if exists rounds_awarded;

drop index if exists weekly_pvp_assignments_cycle_idx;
create index if not exists weekly_pvp_assignments_cycle_idx on public.weekly_pvp_assignments(cycle_id, pvp_type, round_number);

alter table public.notifications
  add column if not exists dedupe_key text;

drop index if exists notifications_user_dedupe_idx;
create unique index notifications_user_dedupe_idx on public.notifications(user_id, dedupe_key);
