-- ============================================================
-- Bay Homes Ops Tracker — migration (2026-09-03c)
-- Run once in Supabase Dashboard > SQL Editor > New query, then Run.
--
-- Adds the "people" table — lets anyone set their own display name
-- (e.g. a shared login like info@bayhomes.co can still show as
-- "Mariam"), visible to the whole team, not just remembered locally.
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
