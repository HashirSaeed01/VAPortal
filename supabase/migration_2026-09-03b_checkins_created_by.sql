-- ============================================================
-- Bay Homes Ops Tracker — migration (2026-09-03b)
-- Run once in Supabase Dashboard > SQL Editor > New query, then Run.
-- Safe to re-run — everything here is idempotent (IF NOT EXISTS).
--
-- 1) Adds "created_by" to tasks — who entered the task into the
--    tracker, separate from "reported_by" (who flagged the issue).
--    Set automatically from whoever you're "signed in as" in the
--    header when you add a task.
-- 2) Adds the "checkins" table — a log of "I just went through the
--    to-do list" check-ins, one row per person per check. Powers the
--    recheck timeline rail on the right of the task view.
-- ============================================================

alter table public.tasks add column if not exists created_by text default '';

create table if not exists public.checkins (
  id          uuid primary key default gen_random_uuid(),
  person      text not null,
  checked_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

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
