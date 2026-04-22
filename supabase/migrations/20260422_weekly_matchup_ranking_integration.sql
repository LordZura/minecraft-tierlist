alter table public.fight_logs
  add column if not exists source text not null default 'fight_log',
  add column if not exists weekly_assignment_id uuid references public.weekly_pvp_assignments(id) on delete set null;

update public.fight_logs
set source = 'fight_log'
where source is null;

create index if not exists fight_logs_weekly_assignment_idx
  on public.fight_logs(weekly_assignment_id)
  where weekly_assignment_id is not null;

create unique index if not exists fight_logs_weekly_assignment_unique_idx
  on public.fight_logs(weekly_assignment_id)
  where weekly_assignment_id is not null;

alter table public.fight_logs
  drop constraint if exists fight_logs_source_chk;
alter table public.fight_logs
  add constraint fight_logs_source_chk
  check (source in ('fight_log', 'weekly_round', 'weekly_default'));
