-- ============================================================
-- Bay Homes Ops Tracker — replace tasks (2026-09-03)
-- Run in Supabase Dashboard > SQL Editor > New query, then Run.
-- Wipes every existing task and loads this new list instead.
-- Safe to re-run in full (delete + insert together) — just don't
-- run only the insert half twice, that would duplicate rows.
--
-- A few items had no property stated, so a best guess was made —
-- check these once loaded:
--   * "Tamearra — dog poop complaint" filed under 1428 Ninth (Ninth
--     Alameda), since Tamearra was tied to that property before.
--   * RH1 inquiry / Bryan / Clair / Calvin / rent-payment text / mail
--     text — no property given, filed under General / Admin.
-- ============================================================

delete from public.tasks;

insert into public.tasks (title, property, type, start_date, status, notes, reported_by, assigned_to, priority) values
('Tamearra — dog poop complaint', '1428 Ninth', 'Cleaning', '', 'To Start', '', 'Tamearra', '', false),
('RH1 inquiry', 'General / Admin', 'Airbnb Inquiry', '', 'To Start', '', 'Lorenza', '', false),
('Bryan — looking for an update', 'General / Admin', 'Awaiting Response', '', 'To Start', '', 'Bryan', '', false),
('Clair — pending reservation', 'General / Admin', 'Airbnb Inquiry', '', 'To Start', '', 'Clair', '', false),
('Pay Benny', 'General / Admin', 'To Pay', '', 'To Start', '', '', '', false),
('Pay Kevin', 'General / Admin', 'To Pay', '', 'To Start', '', '', '', false),
('Reply to Will', 'General / Admin', 'Awaiting Response', '', 'To Start', '', '', '', false),
('Schedule Luis for Valencia', 'Valencia / Clinton Park', 'Task', '', 'To Start', 'Next week.', '', 'Luis', false),
('Gabe sent revised plans', 'General / Admin', 'Task', '', 'To Review by Carrie', '', 'Gabe', '', false),
('To-dos from Hospitable', 'General / Admin', 'Task', '', 'To Start', '', '', '', false),
('Calvin — requesting fly strips', 'General / Admin', 'Request', '', 'To Start', '', 'Calvin', '', false),
('Text from tenant asking about Sept rent payments', 'General / Admin', 'Awaiting Response', '', 'To Start', '', '', '', false),
('Text from tenant asking about mail at Russell', 'Russell', 'Awaiting Response', '', 'To Start', '', '', '', false),
('Valencia — increase garbage bins, spigot, two kitchen faucets', 'Valencia / Clinton Park', 'Task', '', 'To Start', '', '', '', false),
('Bin Detailer invoice', 'General / Admin', 'To Pay', '', 'To Start', '', '', '', false),
('Contractor meeting', 'General / Admin', 'Reminder', '9/8/2026', 'Scheduled', '8:45am', '', '', false),
('Hospitable meeting', 'General / Admin', 'Reminder', '', 'To Start', '', '', '', false);
