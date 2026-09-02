export const STALE_DAYS = 14;

export const PROPERTIES = [
  "Sherman", "Valencia / Clinton Park", "Guerrero", "Russell",
  "Taylor", "1428 Ninth", "VA / Mariam", "General / Admin",
];

// Buckets that live in PROPERTIES (so tasks can be filed under them) but
// aren't real estate — don't show these as property cards / contact lists.
export const NON_PROPERTY_BUCKETS = ["VA / Mariam", "General / Admin"];

// Friendlier display names — the underlying property value (used for every
// task/contact/checklist row already saved) never changes, only the label.
export const PROPERTY_LABELS = {
  "Sherman": "1508 Sherman, Alameda",
  "Valencia / Clinton Park": "224-228 Valencia & 108-112 Clinton Park, SF",
  "Guerrero": "578-586 Guerrero, SF",
  "Russell": "2335 Russell, Berkeley",
  "1428 Ninth": "1428 Ninth St, Alameda",
};
export function propertyLabel(p) {
  return PROPERTY_LABELS[p] || p;
}

// Sentinel used by contacts (only) for a vendor who serves every property —
// avoids one row per property for e.g. a handyman who covers everything.
export const ALL_PROPERTIES = "All Properties";

// Suggestions only (free text underneath) — who flags issues / who fixes them.
export const STAFF = [
  "Carrie", "Luis", "Benny", "Kevin", "Sylvia", "Leo", "Pablo", "Ryan", "Mariam", "Hashir",
];

// Suggestions only — trade/role of a property's contractor or vendor.
export const CONTACT_ROLES = [
  "Plumber", "Electrician", "Handyman", "Locksmith", "HVAC", "Appliance Repair",
  "Cleaner", "Landscaper", "Painter", "Pest Control", "Property Manager", "Other",
];

// A key date "coming up soon" starts showing an alert this many days out.
export const KEY_DATE_ALERT_DAYS = 30;

// Next occurrence of an annual month/day (this year if not passed, else next).
export function nextOccurrence(month, day) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thisYear = new Date(today.getFullYear(), month - 1, day);
  return thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, month - 1, day);
}
export function daysUntil(month, day) {
  const target = nextOccurrence(month, day);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

export const TYPES = [
  "Plumbing", "Electrical", "Doors & Locks", "Furniture", "Appliances",
  "Cleaning", "Maintenance", "To Pay", "To Purchase", "Awaiting Response",
  "Task", "Request", "Reminder", "Training", "Airbnb Inquiry", "Other",
];

export const STATUSES = [
  "To Start", "Scheduled", "On Going", "Currently Monitoring",
  "To Review by Carrie", "Confirm by Carrie", "Complete", "No Action Needed",
];

const DONE_STATUSES = ["Complete", "No Action Needed"];
const CARRIE_STATUSES = ["To Review by Carrie", "Confirm by Carrie"];
const NOT_STARTED_STATUSES = ["To Start"];

export const STATES = ["Not Started", "In Progress", "Waiting on Carrie", "Done"];

export const STATE_META = {
  "Not Started":       { color: "#f87171", chip: "bg-red-500/10 text-red-400 ring-red-500/30" },
  "In Progress":       { color: "#60a5fa", chip: "bg-blue-500/10 text-blue-400 ring-blue-500/30" },
  "Waiting on Carrie": { color: "#fbbf24", chip: "bg-amber-500/10 text-amber-400 ring-amber-500/30" },
  "Done":              { color: "#34d399", chip: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30" },
};

export function stateOf(status) {
  if (DONE_STATUSES.includes(status)) return "Done";
  if (CARRIE_STATUSES.includes(status)) return "Waiting on Carrie";
  if (NOT_STARTED_STATUSES.includes(status)) return "Not Started";
  return "In Progress";
}

export function parseDate(s) {
  if (!s) return null;
  const parts = String(s).split("/");
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

export function daysSince(s) {
  const dt = parseDate(s);
  if (!dt) return null;
  return Math.floor((Date.now() - dt.getTime()) / 86400000);
}

// Seeded into the database on first run only (when the tasks table is empty).
export const SEED = [
  { title: "Sherman A — smoke detectors missing in living room & kitchen; stove hood not working", property: "Sherman", type: "Maintenance", startDate: "7/23/2026", status: "Scheduled", notes: "Sunday morning 9:00am" },
  { title: "112 Clinton Park (Andre Triana Reyes) — replace blinds x2, 30.5x70", property: "Valencia / Clinton Park", type: "Maintenance", startDate: "7/27/2026", status: "On Going", notes: "Still waiting for tenant's confirmation for Saturday 9-12p visit" },
  { title: "Fix gate at Guerrero", property: "Guerrero", type: "Maintenance", startDate: "8/17/2026", status: "Scheduled", notes: "Saturday morning 9-12" },
  { title: "Back fence is difficult to open", property: "General / Admin", type: "Maintenance", startDate: "8/18/2026", status: "Scheduled", notes: "Sunday morning 9:00am" },
  { title: "Russell (Terry KF) — kitchen window handle broken; drawer right of sink broken", property: "Russell", type: "Maintenance", startDate: "8/17/2026", status: "To Start", notes: "Confirm if this should be added to Maintenance list, and whether to send Luis." },
  { title: "ACME invoice (45424) — $288.74 + $51.46", property: "General / Admin", type: "To Pay", startDate: "8/10/2026", status: "To Review by Carrie", notes: "" },
  { title: "Ronnie — invoice for Jul-Aug", property: "General / Admin", type: "Training", startDate: "8/17/2026", status: "To Review by Carrie", notes: "Invoice for Jul-Aug" },
  { title: "Cari Designs Architecture bill — $3,260.00", property: "General / Admin", type: "To Pay", startDate: "8/19/2026", status: "To Review by Carrie", notes: "" },
  { title: "Taylor (Tamearra) — laundry concern", property: "Taylor", type: "Awaiting Response", startDate: "8/10/2026", status: "Currently Monitoring", notes: "Response sent to Tamearra. Monitor thread for reply." },
  { title: "John — rug cleaning invoice + Zelle proof; confirm deposit & outstanding balance", property: "General / Admin", type: "Awaiting Response", startDate: "8/18/2026", status: "To Review by Carrie", notes: "Two supporting files on Drive." },
  { title: "Terry KF — asking if/when relocation payment allowance will be sent", property: "Russell", type: "Awaiting Response", startDate: "8/18/2026", status: "To Review by Carrie", notes: "" },
  { title: "Megan tour at 1428 9th Street — Thursday between 4 and 6", property: "1428 Ninth", type: "Reminder", startDate: "8/11/2026", status: "To Review by Carrie", notes: "Update the date of visit." },
  { title: "Hospitable account setup", property: "General / Admin", type: "Reminder", startDate: "8/24/2026", status: "Scheduled", notes: "Rescheduled to Aug 24, 2026 11:15 AM." },
  { title: "Confirm name of new tenant in 108 Clinton Park SF", property: "Valencia / Clinton Park", type: "Task", startDate: "", status: "To Review by Carrie", notes: "" },
  { title: "Message all Taylor guests about the laundry room", property: "Taylor", type: "Task", startDate: "8/11/2026", status: "To Start", notes: "Reminder re: 900 Taylor laundry — remove laundry promptly, set reminders, respect others' belongings." },
  { title: "Update wifi (name & password) on all Sherman/Taylor Airbnb listings", property: "Sherman", type: "Task", startDate: "8/12/2026", status: "On Going", notes: "Sherman updated. Confirm if Taylor's wifi password was changed." },
  { title: "Airbnb access needs verification", property: "General / Admin", type: "Task", startDate: "8/13/2026", status: "To Review by Carrie", notes: "Airbnb Property Assistant access requires verification (last 4 of SSN or ID)." },
  { title: "Armada schedule notification — service 08/18-08/31 during business hours", property: "General / Admin", type: "Other", startDate: "8/17/2026", status: "To Review by Carrie", notes: "Weekend service not guaranteed. 9am-5pm regular hours." },
  { title: "Keally — table leg missing a bolt", property: "Sherman", type: "Awaiting Response", startDate: "8/26/2026", status: "Confirm by Carrie", notes: "Carrie reached out to FB Marketplace sellers. Follow up." },
  { title: "Keally — spoons", property: "Sherman", type: "Awaiting Response", startDate: "8/27/2026", status: "Complete", notes: "Delivered." },
  { title: "Keally — towels (ordered)", property: "Sherman", type: "To Purchase", startDate: "8/27/2026", status: "Currently Monitoring", notes: "Ordered from Amazon. 08/28: delivered to front door/porch — let Keally know." },
  { title: "Keally — batteries", property: "Sherman", type: "To Pay", startDate: "8/27/2026", status: "Complete", notes: "Reimbursed." },
  { title: "Compile meeting notes into shared drive (repository created)", property: "VA / Mariam", type: "Training", startDate: "8/27/2026", status: "To Review by Carrie", notes: "Repository linked on Drive." },
  { title: "Keally — trash issue", property: "Sherman", type: "Reminder", startDate: "8/27/2026", status: "No Action Needed", notes: "" },
  { title: "Call Canology via Bay Homes Google Voice", property: "Valencia / Clinton Park", type: "Maintenance", startDate: "8/27/2026", status: "To Review by Carrie", notes: "Rebecca reported fruit flies at shared bins. Canology confirmed 9/12; first visit 2 trash + 2 organic, then 1+1 bi-monthly. Extra cost invoiced. 08/29: replied to Rebecca." },
  { title: "108 Clinton Park — 2 kitchen outlets not working", property: "Valencia / Clinton Park", type: "Maintenance", startDate: "8/27/2026", status: "To Review by Carrie", notes: "Reset button tried, did not fix. Water heater handled separately. Confirm it's in the maintenance tracker + follow up on repair." },
  { title: "Share meeting notes & transcript with Hashir", property: "VA / Mariam", type: "Training", startDate: "8/27/2026", status: "Complete", notes: "Sent notes and action items via Google Chat." },
  { title: "Airbnb booking inquiry — Aug 31 to Sep 7", property: "Taylor", type: "Airbnb Inquiry", startDate: "8/27/2026", status: "To Review by Carrie", notes: "Travel nurse starting at UCSF Benioff Sept 1, traveling with partner. Requested $800 total for 7 nights before long-term move-in." },
  { title: "Sherman #B (Keally) — send money for bar of soap & Windex", property: "Sherman", type: "Airbnb Inquiry", startDate: "8/28/2026", status: "To Review by Carrie", notes: "" },
  { title: "Forest — garbage bin clean-up for compost bins (228 Valencia)", property: "Valencia / Clinton Park", type: "Maintenance", startDate: "8/28/2026", status: "Confirm by Carrie", notes: "Confirm if $400 for all four bins is fine." },
  { title: "Bin cleaning access (228 Valencia)", property: "Valencia / Clinton Park", type: "Request", startDate: "8/28/2026", status: "To Start", notes: "Rebecca can't move bins out. Someone must move them to the sidewalk by 7:00 a.m. on cleaning day. Waiting on Carrie for who handles it." },
  { title: "Keally reimbursement (Windex and soap)", property: "Sherman", type: "To Pay", startDate: "8/28/2026", status: "Complete", notes: "Reimburse via Hospitable if not already done." },
  { title: "Zillow — Robert Dickinson (interest + tour request)", property: "General / Admin", type: "Request", startDate: "8/28/2026", status: "To Review by Carrie", notes: "Applicant details/credit info in email. Confirm how/when to handle the tour, then reply to Robert." },
  { title: "Zillow — Anzhela (interest + tour request)", property: "General / Admin", type: "Request", startDate: "8/28/2026", status: "To Review by Carrie", notes: "Applicant details/credit info in email. Confirm tour arrangements, then reply to Anzhela." },
  { title: "Stessa — Diego Hernandez (Guerrero) — verify payment status", property: "Guerrero", type: "Reminder", startDate: "8/28/2026", status: "Confirm by Carrie", notes: "Verify payment status in Stessa and update records." },
  { title: "Stessa — Immanuel Abdi (224-228 Valencia) — verify payment status", property: "Valencia / Clinton Park", type: "Reminder", startDate: "8/28/2026", status: "Confirm by Carrie", notes: "Verify payment status in Stessa and update records." },
  { title: "Google security alert — review", property: "General / Admin", type: "Reminder", startDate: "8/28/2026", status: "To Review by Carrie", notes: "Escalate only if it requires account/security action." },
];
