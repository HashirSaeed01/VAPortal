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
  reported_by text default '',
  assigned_to text default '',
  priority    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 1b) Patch columns onto an already-existing table (safe to re-run)
alter table public.tasks add column if not exists reported_by text default '';
alter table public.tasks add column if not exists assigned_to text default '';
alter table public.tasks add column if not exists priority boolean not null default false;
alter table public.tasks add column if not exists unit text default '';
alter table public.tasks add column if not exists created_by text default '';

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

-- ============================================================
-- 5) Contacts — contractors/vendors tied to a property (name, role,
--    phone, email). Shown on the property's task view in the app.
-- ============================================================
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  property    text not null,
  name        text not null,
  role        text default '',
  phone       text default '',
  email       text default '',
  notes       text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;

drop policy if exists "authenticated can read"   on public.contacts;
drop policy if exists "authenticated can insert" on public.contacts;
drop policy if exists "authenticated can update" on public.contacts;
drop policy if exists "authenticated can delete" on public.contacts;

create policy "authenticated can read"   on public.contacts for select to authenticated using (true);
create policy "authenticated can insert" on public.contacts for insert to authenticated with check (true);
create policy "authenticated can update" on public.contacts for update to authenticated using (true) with check (true);
create policy "authenticated can delete" on public.contacts for delete to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contacts'
  ) then
    alter publication supabase_realtime add table public.contacts;
  end if;
end $$;

-- ============================================================
-- 6) Checklist items — recurring per-property, per-category to-dos
--    (e.g. a standing "Plumbing" or "Cleaning" checklist), separate
--    from one-off tasks.
-- ============================================================
create table if not exists public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  property    text not null,
  category    text not null default 'Other',
  text        text not null,
  checked     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists checklist_items_set_updated_at on public.checklist_items;
create trigger checklist_items_set_updated_at
  before update on public.checklist_items
  for each row execute function public.set_updated_at();

alter table public.checklist_items enable row level security;

drop policy if exists "authenticated can read"   on public.checklist_items;
drop policy if exists "authenticated can insert" on public.checklist_items;
drop policy if exists "authenticated can update" on public.checklist_items;
drop policy if exists "authenticated can delete" on public.checklist_items;

create policy "authenticated can read"   on public.checklist_items for select to authenticated using (true);
create policy "authenticated can insert" on public.checklist_items for insert to authenticated with check (true);
create policy "authenticated can update" on public.checklist_items for update to authenticated using (true) with check (true);
create policy "authenticated can delete" on public.checklist_items for delete to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'checklist_items'
  ) then
    alter publication supabase_realtime add table public.checklist_items;
  end if;
end $$;

-- ============================================================
-- 7) Task calls — "who do we need to call about this task", checked off
--    live so two people don't call the same contractor twice.
-- ============================================================
create table if not exists public.task_calls (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  text        text not null,
  called      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists task_calls_set_updated_at on public.task_calls;
create trigger task_calls_set_updated_at
  before update on public.task_calls
  for each row execute function public.set_updated_at();

alter table public.task_calls enable row level security;

drop policy if exists "authenticated can read"   on public.task_calls;
drop policy if exists "authenticated can insert" on public.task_calls;
drop policy if exists "authenticated can update" on public.task_calls;
drop policy if exists "authenticated can delete" on public.task_calls;

create policy "authenticated can read"   on public.task_calls for select to authenticated using (true);
create policy "authenticated can insert" on public.task_calls for insert to authenticated with check (true);
create policy "authenticated can update" on public.task_calls for update to authenticated using (true) with check (true);
create policy "authenticated can delete" on public.task_calls for delete to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_calls'
  ) then
    alter publication supabase_realtime add table public.task_calls;
  end if;
end $$;

-- ============================================================
-- 8) Key dates — recurring annual compliance calendar (taxes, licenses,
--    registrations). month/day repeat every year; the app computes the
--    next occurrence and alerts as it approaches.
-- ============================================================
create table if not exists public.key_dates (
  id          uuid primary key default gen_random_uuid(),
  property    text default '',
  title       text not null,
  month       int not null check (month between 1 and 12),
  day         int not null check (day between 1 and 31),
  notes       text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists key_dates_set_updated_at on public.key_dates;
create trigger key_dates_set_updated_at
  before update on public.key_dates
  for each row execute function public.set_updated_at();

alter table public.key_dates enable row level security;

drop policy if exists "authenticated can read"   on public.key_dates;
drop policy if exists "authenticated can insert" on public.key_dates;
drop policy if exists "authenticated can update" on public.key_dates;
drop policy if exists "authenticated can delete" on public.key_dates;

create policy "authenticated can read"   on public.key_dates for select to authenticated using (true);
create policy "authenticated can insert" on public.key_dates for insert to authenticated with check (true);
create policy "authenticated can update" on public.key_dates for update to authenticated using (true) with check (true);
create policy "authenticated can delete" on public.key_dates for delete to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'key_dates'
  ) then
    alter publication supabase_realtime add table public.key_dates;
  end if;
end $$;

-- ============================================================
-- 9) Properties — real properties, editable from the app (name,
--    display label, active flag, sort order) instead of hardcoded.
-- ============================================================
create table if not exists public.properties (
  key         text primary key,
  label       text not null,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

alter table public.properties enable row level security;

drop policy if exists "authenticated can read"   on public.properties;
drop policy if exists "authenticated can insert" on public.properties;
drop policy if exists "authenticated can update" on public.properties;
drop policy if exists "authenticated can delete" on public.properties;

create policy "authenticated can read"   on public.properties for select to authenticated using (true);
create policy "authenticated can insert" on public.properties for insert to authenticated with check (true);
create policy "authenticated can update" on public.properties for update to authenticated using (true) with check (true);
create policy "authenticated can delete" on public.properties for delete to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'properties'
  ) then
    alter publication supabase_realtime add table public.properties;
  end if;
end $$;

-- ============================================================
-- 10) Units — individual units within a property (label, sqft,
--     tenant, furniture, paint color, notes).
-- ============================================================
create table if not exists public.units (
  id          uuid primary key default gen_random_uuid(),
  property    text not null references public.properties(key),
  label       text not null,
  sqft        int,
  tenant      text default '',
  furniture   text default '',
  paint_color text default '',
  notes       text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists units_set_updated_at on public.units;
create trigger units_set_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

alter table public.units enable row level security;

drop policy if exists "authenticated can read"   on public.units;
drop policy if exists "authenticated can insert" on public.units;
drop policy if exists "authenticated can update" on public.units;
drop policy if exists "authenticated can delete" on public.units;

create policy "authenticated can read"   on public.units for select to authenticated using (true);
create policy "authenticated can insert" on public.units for insert to authenticated with check (true);
create policy "authenticated can update" on public.units for update to authenticated using (true) with check (true);
create policy "authenticated can delete" on public.units for delete to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'units'
  ) then
    alter publication supabase_realtime add table public.units;
  end if;
end $$;

-- ============================================================
-- 11) Checkins — a log of "I just went through the to-do list"
--     check-ins, one row per person per check. Powers the recheck
--     timeline rail on the task view.
-- ============================================================
create table if not exists public.checkins (
  id           uuid primary key default gen_random_uuid(),
  person       text not null,
  person_email text default '',
  checked_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
alter table public.checkins add column if not exists person_email text default '';

alter table public.checkins enable row level security;

drop policy if exists "authenticated can read"   on public.checkins;
drop policy if exists "authenticated can insert" on public.checkins;
drop policy if exists "authenticated can update" on public.checkins;
drop policy if exists "authenticated can delete" on public.checkins;

create policy "authenticated can read"   on public.checkins for select to authenticated using (true);
create policy "authenticated can insert" on public.checkins for insert to authenticated with check (true);
create policy "authenticated can update" on public.checkins for update to authenticated using (true) with check (true);
create policy "authenticated can delete" on public.checkins for delete to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'checkins'
  ) then
    alter publication supabase_realtime add table public.checkins;
  end if;
end $$;

-- ============================================================
-- 12) People — lets anyone set their own display name (e.g. a shared
--     login like info@bayhomes.co can still show as "Mariam"),
--     visible to the whole team, not just remembered locally.
-- ============================================================
create table if not exists public.people (
  email        text primary key,
  display_name text not null,
  updated_at   timestamptz not null default now()
);

drop trigger if exists people_set_updated_at on public.people;
create trigger people_set_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();

alter table public.people enable row level security;

drop policy if exists "authenticated can read"   on public.people;
drop policy if exists "authenticated can insert" on public.people;
drop policy if exists "authenticated can update" on public.people;
drop policy if exists "authenticated can delete" on public.people;

create policy "authenticated can read"   on public.people for select to authenticated using (true);
create policy "authenticated can insert" on public.people for insert to authenticated with check (true);
create policy "authenticated can update" on public.people for update to authenticated using (true) with check (true);
create policy "authenticated can delete" on public.people for delete to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'people'
  ) then
    alter publication supabase_realtime add table public.people;
  end if;
end $$;
