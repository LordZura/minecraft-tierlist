alter table public.users
  add column if not exists is_super_admin boolean not null default false;

update public.users
set is_super_admin = true
where is_admin = true and is_super_admin = false;

alter table public.weekly_pvp_cycles
  add column if not exists ended_by_admin boolean not null default false,
  add column if not exists reset_by_admin_id uuid references public.users(id) on delete set null,
  add column if not exists reset_reason text;

alter table public.weekly_pvp_cycles
  drop constraint if exists weekly_pvp_cycles_status_chk;
alter table public.weekly_pvp_cycles
  add constraint weekly_pvp_cycles_status_chk check (status in ('upcoming','active','completed','cancelled'));

alter table public.weekly_pvp_assignments
  drop constraint if exists weekly_pvp_assignments_status_chk;
alter table public.weekly_pvp_assignments
  add constraint weekly_pvp_assignments_status_chk check (status in ('pending','ready','completed','expired','cancelled'));

create unique index if not exists weekly_pvp_cycles_single_active_idx
  on public.weekly_pvp_cycles(status)
  where status = 'active';

create table if not exists public.admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  target_table text,
  target_id text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_action_logs_actor_idx on public.admin_action_logs(actor_id, created_at desc);
create index if not exists admin_action_logs_target_idx on public.admin_action_logs(target_table, target_id, created_at desc);
