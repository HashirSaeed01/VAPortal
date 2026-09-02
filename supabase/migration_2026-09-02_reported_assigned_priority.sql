-- ============================================================
-- Bay Homes Ops Tracker — migration (2026-09-02)
-- Run once in Supabase Dashboard > SQL Editor > New query, then Run.
-- Safe to re-run for the schema changes (columns/tables use IF NOT
-- EXISTS); the insert at the bottom is a one-time data load — running
-- it twice will duplicate those rows, so only run it once.
--
-- 1) Adds "reported_by" / "assigned_to" / "priority" to tasks.
-- 2) Adds the "contacts" table (contractors/vendors per property, or
--    "All Properties" for anyone who covers everything).
-- 3) Adds the "checklist_items" table (recurring per-property,
--    per-category checklists, e.g. a standing "Cleaning" checklist).
-- 4) Adds the "task_calls" table — a per-task call list ("who do we
--    need to call about this"), checked off live so two people don't
--    call the same contractor twice.
-- 5) Adds the "key_dates" table — recurring annual compliance calendar
--    (taxes, licenses, registrations) with alerts as dates approach.
-- 6) Loads today's punch list (900A/900B, 1428A Ninth, Valencia /
--    Clinton Park, 2335 Russell, follow-ups) as real tasks, filed
--    under the new trade-specific categories (Plumbing, Electrical,
--    Doors & Locks, etc.).
-- 7) Loads your vendor directory as contacts.
-- 8) Loads the recurring tax/license/registration calendar as key dates.
-- ============================================================

alter table public.tasks add column if not exists reported_by text default '';
alter table public.tasks add column if not exists assigned_to text default '';
alter table public.tasks add column if not exists priority boolean not null default false;

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

insert into public.tasks (title, property, type, start_date, status, notes, reported_by, assigned_to, priority) values
('900A/900T (Front Studio) — Fix leaking kitchen faucet', 'Taylor', 'Plumbing', '', 'Complete', '', 'Ryan', 'Luis', false),
('900A/900T (Front Studio) — Confirm Leo found a clean comforter cover', 'Taylor', 'Task', '', 'On Going', '', '', 'Leo', false),
('900A/900T (Front Studio) — Drop off sheets & duvet for spare bed', 'Taylor', 'Task', '', 'To Start', '', 'Pablo', 'Carrie', true),
('900A/900T (Front Studio) — Replace duvet on queen bed', 'Taylor', 'Task', '', 'On Going', 'Needed to close out Ryan''s cleaning complaints below.', 'Leo', 'Carrie', false),
('900A/900T (Front Studio) — Magic eraser on wall spots', 'Taylor', 'Cleaning', '', 'To Start', '', '', 'Carrie', false),
('900A/900T (Front Studio) — Touchup kitchen cabinets & walls', 'Taylor', 'Maintenance', '', 'Complete', '', '', 'Benny', false),
('900A/900T (Front Studio) — Address Ryan''s cleaning complaints', 'Taylor', 'Cleaning', '', 'On Going', 'Stained mattress cover, dirty linens, spare sheets, closet light not working, vacuum availability, dirty TV/stand, re-clean unit. Mostly done — still need the duvet & pillows (per Mariam).', 'Ryan', 'Luis & Leo', false),
('900B (Back Studio) — Look into Lars'' missing guitar', 'Taylor', 'Task', '', 'To Start', '', 'Lars', '', false),
('1428A Ninth St — Rekey front & back door locks', '1428 Ninth', 'Doors & Locks', '', 'Complete', '$195 total (parts & labor) — includes 8 key copies, bringing porch keys, 3 copies for tenant + 2 for records.', '', 'Kevin', false),
('1428A Ninth St — Touchup paint in all rooms', '1428 Ninth', 'Maintenance', '', 'Complete', '', '', 'Benny', false),
('1428A Ninth St — Fix windows that won''t open (post-painting)', '1428 Ninth', 'Maintenance', '', 'Currently Monitoring', 'Painter said once the weather''s dry they''d open again — still not confirmed.', 'Sylvia', 'Benny', false),
('1428A Ninth St — Clean out under kitchen sink & reattach sink sprayer', '1428 Ninth', 'Plumbing', '', 'Complete', 'Rubber sprayer piece is in the drawer just left of the fridge.', 'Sylvia', 'Luis', false),
('1428A Ninth St — Repair little door in kitchen', '1428 Ninth', 'Doors & Locks', '', 'On Going', '', '', 'Benny', false),
('1428A Ninth St — Dishwasher E1 error', '1428 Ninth', 'Appliances', '', 'Complete', '', 'Sylvia', 'Luis', false),
('1428A Ninth St — Put on window screens', '1428 Ninth', 'Maintenance', '', 'Complete', '', 'Sylvia', 'Luis', false),
('1428A Ninth St — Back door: metal plate in jamb, close well, swap knob to silver, remove chair out front', '1428 Ninth', 'Doors & Locks', '', 'Complete', '', 'Sylvia', 'Luis', false),
('1428A Ninth St — Install flip lock on back door', '1428 Ninth', 'Doors & Locks', '', 'To Start', '', '', 'Carrie', false),
('Valencia — Increase trash cans', 'Valencia / Clinton Park', 'Request', '', 'To Start', '', '', '', false),
('Valencia — Spigot installation', 'Valencia / Clinton Park', 'Plumbing', '', 'To Start', '', '', '', false),
('Clinton Park — Two kitchen faucets', 'Valencia / Clinton Park', 'Plumbing', '', 'To Start', '', '', '', false),
('Clinton Park — Add to Stessa', 'Valencia / Clinton Park', 'Task', '', 'To Start', '', '', '', false),
('2335 Russell — Find contractors', 'Russell', 'Task', '', 'On Going', 'Got a response from Reconstruction Services via email — they''ll do an on-site assessment soon.', '', '', false),
('Reply to Will (wants upgraded materials)', 'General / Admin', 'Awaiting Response', '', 'To Start', '', '', '', false),
('Airbnb welcome message reiterating low-maintenance requests', 'General / Admin', 'Task', '', 'To Start', '', '', '', false),
('Answer Luis re: Valencia', 'Valencia / Clinton Park', 'Awaiting Response', '9/3/2026', 'To Start', 'Due tomorrow evening.', '', 'Luis', false),
('Garden hose delivered to Russell', 'Russell', 'To Purchase', '', 'Complete', '', '', '', false),
('Zillow — Devon Paul Tucker interested in 1428 Alameda', 'General / Admin', 'Request', '', 'To Review by Carrie', 'Zillow lead — tenant interest in 1428 Alameda.', '', '', false);

-- Vendor directory. Rows marked 'All Properties' covered more than one
-- property on the source sheet (e.g. "Alameda & Berkeley") and the exact
-- split wasn't clear enough to guess — the original note is kept below so
-- you can split/reassign a contact to one property via the app if needed.
insert into public.contacts (property, name, role, phone, email, notes) values
('All Properties', 'Leo (MasterMaid Cleaners)', 'Cleaner', '415-990-0182', 'mastermaid@yahoo.com', ''),
('All Properties', 'Vidal', 'Plumber', '(925) 565-6328', '', 'Covers Alameda & Berkeley properties — unsure about SF.'),
('All Properties', 'Luis', 'Handyman', '510-390-4546', '', ''),
('All Properties', 'Kevin', 'Locksmith', '510-365-9600', '', 'Covers Alameda & Berkeley; SF is more expensive.'),
('Russell', 'William Martin', 'Handyman', '(510) 843-1360', 'willm@sonic.net', 'Tenant — unofficial onsite resident, not a paid vendor.'),
('All Properties', 'Forest', 'Pest Control', '(831) 254-2860', '', ''),
('All Properties', 'Zlata V (ADRIUM Service Solutions)', 'Appliance Repair', '(510) 990-9149', '', 'Covers Alameda & Berkeley properties.'),
('All Properties', 'Dennis (HandyDen)', 'Handyman', '(442) 258-7568', '', 'Covers San Francisco properties (Guerrero, Valencia / Clinton Park).'),
('All Properties', 'United Appliance & HVAC Repair', 'Appliance Repair', '(415) 968-1958', '', 'Covers San Francisco properties (Guerrero, Valencia / Clinton Park).'),
('All Properties', 'Antonio Cárcamo Reyes (Plumbing & Rooter Service)', 'Plumber', '707-384-8147', 'antonio@plumbingandrooterservice.com', ''),
('All Properties', 'Jim Ross (Advanced IPM)', 'Pest Control', '(650) 710 0427', 'jimross@advancedipm.com', 'Covers San Francisco properties — alternate to Forest.'),
('Russell', 'Reed Security Brothers', 'Locksmith', '(510) 652-2477', '', ''),
('All Properties', 'Julio', 'Landscaper', '(650) 207-1402', '', 'Covers Alameda properties (Sherman, 1428 Ninth).'),
('All Properties', 'Rose (The Bin Detailers)', 'Cleaner', '(650) 801-2165', '', 'Cleaning vendor — business based in Belmont.');

-- Recurring annual compliance calendar (taxes, licenses, registrations),
-- pulled from your key-dates sheet. Most of these apply company-wide, not
-- to a single property, so "property" is left blank except where a filing
-- was clearly named after one property's holding entity. The last row
-- ("Ninth Berkeley LLC") references an address/entity not yet in this
-- tracker's property list — worth confirming which property that is.
insert into public.key_dates (property, title, month, day, notes) values
('', 'Federal & CA estimated tax payment (Q4)', 1, 15, ''),
('', 'Berkeley business license renewal', 1, 31, ''),
('1428 Ninth', 'Ninth Alameda LLC — Statement of Information (even years)', 1, 31, 'Files even years — bizfile.sos.ca.gov'),
('', 'Corporate tax return due', 9, 15, ''),
('', 'Alameda Rent Program fee', 9, 30, 'registry.alamedarentprogram.org'),
('', 'Federal & CA estimated tax payment (Q3)', 9, 15, ''),
('', 'Property tax installment 1 due', 2, 1, ''),
('Guerrero', 'River Sales Grp LLC — Statement of Information (even years)', 2, 28, 'Files even years — best guess this is the Guerrero entity, confirm.'),
('', 'Alameda business license renewal', 6, 30, ''),
('', 'Federal & CA estimated tax payment (Q2)', 6, 15, ''),
('', 'Extended tax return due', 10, 15, ''),
('', 'Defined benefit plan contribution deadline', 10, 15, ''),
('', 'SF business registration renewal', 2, 15, ''),
('', 'Berkeley business license considered late after this date', 3, 1, ''),
('', 'SF Healthy Housing / Vector Control', 3, 31, ''),
('', 'Berkeley Rent Board registration', 7, 1, ''),
('', 'Alameda rent registration fee', 7, 1, ''),
('', 'Berkeley RHSP (Rental Housing Safety Program)', 11, 1, ''),
('', 'Property tax installment 2 due', 11, 1, ''),
('', 'Berkeley rent increase notice deadline', 11, 15, ''),
('', 'Property tax installment 2 — final due date', 4, 10, ''),
('', 'Federal & CA estimated tax payment (Q1)', 4, 15, ''),
('', 'Tax filing deadline', 4, 15, ''),
('', 'Ninth Berkeley LLC — Statement of Information (odd years)', 8, 31, 'Property/entity not yet in the tracker (source sheet lists "1412-1416 Ninth St, Berkeley" separately from "1428 Ninth St, Alameda") — confirm which property this covers.');
