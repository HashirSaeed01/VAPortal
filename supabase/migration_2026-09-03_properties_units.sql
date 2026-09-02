-- ============================================================
-- Bay Homes Ops Tracker — migration (2026-09-03)
-- Run once in Supabase Dashboard > SQL Editor > New query, then Run.
-- Safe to re-run for the schema changes (columns/tables use IF NOT
-- EXISTS); the Taylor merge and seed inserts near the bottom are
-- one-time data loads — running them twice will duplicate/re-touch
-- rows, so only run this file once.
--
-- 1) Adds the "properties" table — real properties now live here
--    (name, display label, active flag, sort order) instead of being
--    hardcoded, so they can be added/renamed/retired from the app.
-- 2) Adds the "units" table — individual units within a property
--    (label, sqft, tenant, furniture, paint color, notes).
-- 3) Adds "unit" to tasks, so a task can optionally point at one unit
--    instead of the whole property.
-- 4) Merges "Taylor" into "1428 Ninth" (one property, "Ninth Alameda")
--    across every table that references it, matching the real unit
--    sheet: 1428A, 1428B, 900A Taylor, 900B Taylor, 902A, 902B.
-- 5) Seeds the 5 active properties + known units from your unit sheet.
--    Guerrero's "578-586 Guerrero, SF" is a good example of a longer
--    display label — three unit rows there had tenant names cut off
--    in the screenshot (flagged in their notes) — verify/complete
--    those in the app.
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

alter table public.tasks add column if not exists unit text default '';

-- Merge Taylor into 1428 Ninth (Ninth Alameda) across every table.
update public.tasks           set property = '1428 Ninth' where property = 'Taylor';
update public.contacts        set property = '1428 Ninth' where property = 'Taylor';
update public.key_dates       set property = '1428 Ninth' where property = 'Taylor';
update public.checklist_items set property = '1428 Ninth' where property = 'Taylor';

-- Active properties (sort order matches your unit sheet).
insert into public.properties (key, label, is_active, sort_order) values
('Russell', '2335 Russell, Berkeley', true, 1),
('Sherman', '1508 Sherman, Alameda', true, 2),
('1428 Ninth', '1428 Ninth St, Alameda (Ninth Alameda)', true, 3),
('Valencia / Clinton Park', '224-228 Valencia & 108-112 Clinton Park, SF', true, 4),
('Guerrero', '578-586 Guerrero, SF', true, 5)
on conflict (key) do update set label = excluded.label, is_active = excluded.is_active, sort_order = excluded.sort_order;

-- Units, transcribed from your unit sheet.
insert into public.units (property, label, sqft, tenant, notes) values
('Sherman', 'A', null, 'Airbnb', ''),
('Sherman', 'B', null, 'Airbnb', ''),
('Sherman', 'C', null, 'Katy & JC', ''),
('1428 Ninth', '1428A', null, 'Sylvia', ''),
('1428 Ninth', '1428B', null, 'Mitchell Ball', ''),
('1428 Ninth', '900A Taylor', null, 'Airbnb', ''),
('1428 Ninth', '900B Taylor', null, 'Airbnb', ''),
('1428 Ninth', '902A', null, 'Airbnb', ''),
('1428 Ninth', '902B', null, 'Airbnb', ''),
('Valencia / Clinton Park', '108', 600, 'James & Rahul', ''),
('Valencia / Clinton Park', '110', 600, 'Alexandra/Alex Kulick & Daniel Kanzler', ''),
('Valencia / Clinton Park', '112', 600, 'Ren Price, Andre Triana Reyes', ''),
('Valencia / Clinton Park', '224 - 3rd/top floor', 1300, 'Jacques Chen, Ken Hao Lu, Immanuel Abdi, Colin…', 'Tenant list was cut off in the source screenshot — verify/complete the full roster.'),
('Valencia / Clinton Park', '226 - 2nd flr', 1400, 'Amanda Pablo, Ana Rivera, Abigail Estrella, Jorda…', 'Tenant list was cut off in the source screenshot — verify/complete the full roster.'),
('Valencia / Clinton Park', '228', 1350, 'SF Community Acupuncture', ''),
('Guerrero', '578 Guerrero #1', 426, 'Ana Perez', ''),
('Guerrero', '578 Guerrero #2', 473, 'Matthew McQuaid', ''),
('Guerrero', '578 Guerrero #3', 934, 'Jennifer, Erin, Minjoo', ''),
('Guerrero', '586 Guerrero', 273, 'Gretchen Simm', ''),
('Guerrero', '586A Guerrero', 513, 'Eva Wells Rodrigues & Josue Rodrigues Dos Sant…', 'Tenant name was cut off in the source screenshot — verify/complete.'),
('Guerrero', '586B Guerrero', 319, 'Diego Lopez Hernandez, Elizabeth Garthia Altam…', 'Tenant name was cut off in the source screenshot — verify/complete.');
-- Russell had no unit rows visible in the screenshot you shared — add
-- them from the app once you're ready (Units page > Russell > Add unit).
