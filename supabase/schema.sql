-- ============================================================
-- Bay Homes Ops Tracker — database setup
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- Seed data is inserted by the app on first load, so this file only sets up
-- the table, security, and realtime.
-- ============================================================

-- 1) Tasks table
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  property    text not null default 'General / Admin',
  type        text not null default 'Task',
  start_date  text default '',
  status      text not null default 'To Start',
  notes       text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2) Keep updated_at current on every update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- 3) Row Level Security — shared team workspace.
--    Any signed-in user can read and write; anonymous visitors get nothing.
alter table public.tasks enable row level security;

drop policy if exists "authenticated can read"   on public.tasks;
drop policy if exists "authenticated can insert" on public.tasks;
drop policy if exists "authenticated can update" on public.tasks;
drop policy if exists "authenticated can delete" on public.tasks;

create policy "authenticated can read"   on public.tasks for select to authenticated using (true);
create policy "authenticated can insert" on public.tasks for insert to authenticated with check (true);
create policy "authenticated can update" on public.tasks for update to authenticated using (true) with check (true);
create policy "authenticated can delete" on public.tasks for delete to authenticated using (true);

-- 4) Realtime — so teammates see changes live (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;
