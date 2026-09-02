-- ============================================================
-- Bay Homes Ops Tracker — add tasks (2026-09-03)
-- Run in Supabase Dashboard > SQL Editor > New query, then Run.
-- Tasks have no unique key besides id, so only run this once —
-- running it twice will duplicate these rows.
-- ============================================================

insert into public.tasks (title, property, type, start_date, status, notes, reported_by, assigned_to, priority) values
('Valencia — Increase trash cans', 'Valencia / Clinton Park', 'Request', '', 'To Start', '', '', '', false),
('Valencia — Spigot installation', 'Valencia / Clinton Park', 'Plumbing', '', 'To Start', '', '', '', false),
('Clinton Park — Two kitchen faucets', 'Valencia / Clinton Park', 'Plumbing', '', 'To Start', '', '', '', false),
('Clinton Park — Add to Stessa', 'Valencia / Clinton Park', 'Task', '', 'To Start', '', '', '', false),
('2335 Russell — Find contractors', 'Russell', 'Task', '', 'On Going', 'Got a response from Reconstruction Services via email — they''ll do an on-site assessment soon.', '', '', false),
('Reply to Will (wants upgraded materials)', 'General / Admin', 'Awaiting Response', '', 'To Start', '', '', '', false),
('Airbnb welcome message reiterating low-maintenance requests', 'General / Admin', 'Task', '', 'To Start', '', '', '', false),
('Answer Luis re: Valencia', 'Valencia / Clinton Park', 'Awaiting Response', '9/4/2026', 'To Start', 'Due tomorrow evening.', '', 'Luis', false),
('Garden hose delivered to Russell', 'Russell', 'To Purchase', '', 'Complete', '', '', '', false),
('Zillow — Devon Paul Tucker interested in 1428 Alameda', 'General / Admin', 'Request', '', 'To Review by Carrie', 'Zillow lead — tenant interest in 1428 Alameda.', '', '', false),
('A93 — Serene, Private Studio — dog making a mess', 'General / Admin', 'Cleaning', '', 'To Start', 'Someone''s dog is making a mess here. Unit not yet in the tracker''s property list — flag if this needs its own property entry.', '', '', false);
