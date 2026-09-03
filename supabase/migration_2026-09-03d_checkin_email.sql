-- ============================================================
-- Bay Homes Ops Tracker — migration (2026-09-03d)
-- Run once in Supabase Dashboard > SQL Editor > New query, then Run.
--
-- Adds "person_email" to checkins. Previously a check-in stored a
-- snapshot of your display name at click time — renaming yourself
-- later (via the "people" table) made old and new check-ins for the
-- same person look like two different people in the same slot. Now
-- the app resolves the display name live from your email, so a
-- rename applies retroactively to your history too.
-- ============================================================

alter table public.checkins add column if not exists person_email text default '';
