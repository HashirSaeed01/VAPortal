-- ============================================================
-- Bay Homes Ops Tracker — punch list re-insert (2026-09-02)
-- Run in Supabase Dashboard > SQL Editor. Safe to run once; running
-- it twice will duplicate these rows since tasks have no unique key
-- other than id.
-- ============================================================

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
('Zillow — Devon Paul Tucker interested in 1428 Alameda', 'General / Admin', 'Request', '', 'To Review by Carrie', 'Zillow lead — tenant interest in 1428 Alameda.', '', '', false),
('A93 — Serene, Private Studio — dog making a mess', 'General / Admin', 'Cleaning', '', 'To Start', 'Someone''s dog is making a mess here. Unit not yet in the tracker''s property list — flag if this needs its own property entry.', '', '', false);
