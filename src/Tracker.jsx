import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Plus, Trash2, Pencil, X, Download, Search, AlertTriangle, CheckCircle2,
  Clock, Loader2, UserCheck, ChevronDown, ChevronRight, ChevronLeft,
  RefreshCw, LogOut, Flag, FileText, Building2, Phone, Mail, Users, Bell, PhoneCall,
  Copy, Check, Settings, DoorOpen, ClipboardList, ArrowLeft, PlayCircle, UserCircle2,
} from "lucide-react";
import { supabase } from "./lib/supabase.js";
import {
  TYPES, STATUSES, STATES, STATE_META, STALE_DAYS, STAFF, ASSIGNABLE_STAFF,
  NON_PROPERTY_BUCKETS, CONTACT_ROLES, ALL_PROPERTIES, KEY_DATE_ALERT_DAYS,
  stateOf, daysSince, daysUntil, parseDate, recommendContractor,
} from "./data.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Properties now live in the DB (see fetchProperties) — this resolves a
// property key to its friendly label, falling back to the raw key so
// admin buckets (General / Admin, VA / Mariam) and any not-yet-loaded
// property still display something reasonable.
function propertyLabel(key, labels) {
  return (labels && labels[key]) || key;
}

// Best-effort display name from a login email, so the app knows who's
// using it without asking — "hashir.saeed@x.com" -> "Hashir Saeed".
function nameFromEmail(email) {
  if (!email) return "";
  const local = email.split("@")[0];
  const words = local.replace(/[._-]+/g, " ").replace(/\d+/g, " ").trim();
  if (!words) return local;
  return words.split(" ").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

// Local device date, not UTC — matches what <input type="date"> expects/emits.
function toISO(date) {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function todayISO() {
  return toISO(new Date());
}
// Renders in whichever date format the viewer's own browser/OS uses —
// no more one hardcoded US layout for everybody.
function formatDateDisplay(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString() : s;
}

/* ---- DB row <-> app object mapping (DB uses snake_case start_date) ---- */
const toRow = (t) => ({
  title: t.title, property: t.property, type: t.type,
  start_date: t.startDate || "", status: t.status, notes: t.notes || "",
  reported_by: t.reportedBy || "", assigned_to: t.assignedTo || "", priority: !!t.priority,
  unit: t.unit || "", created_by: t.createdBy || "",
});
const fromRow = (r) => ({
  id: r.id, title: r.title, property: r.property, type: r.type,
  startDate: r.start_date || "", status: r.status, notes: r.notes || "",
  reportedBy: r.reported_by || "", assignedTo: r.assigned_to || "", priority: !!r.priority,
  unit: r.unit || "", createdAt: r.created_at || "", createdBy: r.created_by || "",
});

function csvEscape(v) {
  return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type: type || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
const isDone = (t) => stateOf(t.status) === "Done";

/* ------------------------------- UI atoms ------------------------------- */

function Kpi({ label, value, tone, icon: Icon, active, onClick }) {
  const tones = { slate: "text-white", red: "text-red-400", amber: "text-amber-400", emerald: "text-emerald-400" };
  const clickable = typeof onClick === "function";
  return (
    <button type="button" onClick={onClick} disabled={!clickable}
      className={
        "text-left rounded-xl bg-slate-900 border p-4 transition " +
        (clickable ? "cursor-pointer hover:border-slate-500 " : "cursor-default ") +
        (active ? "border-white ring-1 ring-white " : "border-slate-700 ")
      }>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        {Icon ? <Icon size={15} className="text-slate-500" /> : null}
      </div>
      <div className={"mt-2 text-4xl font-bold tabular-nums tracking-tight " + (tones[tone] || tones.slate)}>{value}</div>
    </button>
  );
}

// Free-text input with a dark, styled suggestion list — the native
// <datalist> popup ignores dark theming in most browsers, so this replaces
// it entirely rather than fighting browser chrome we can't style.
function Combobox({ value, onChange, options, placeholder, field }) {
  const [open, setOpen] = useState(false);
  const filtered = options.filter((o) => o.toLowerCase().includes(value.toLowerCase()) && o.toLowerCase() !== value.toLowerCase());
  return (
    <div className="relative">
      <input className={field} value={value} placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && filtered.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-slate-600 bg-slate-800 shadow-lg">
          {filtered.map((o) => (
            <button key={o} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(o); setOpen(false); }}
              className="block w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700">
              {o}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TaskModal({ task, prefill, contacts, properties, units, propertyLabels, onSave, onClose, saving }) {
  const propertyOptions = useMemo(() => {
    const opts = properties.filter((p) => p.is_active).map((p) => p.key);
    // Editing a task filed under a since-deactivated property — keep it
    // selectable so saving doesn't silently reassign it.
    const current = task?.property || prefill?.property;
    if (current && !opts.includes(current) && !NON_PROPERTY_BUCKETS.includes(current)) opts.push(current);
    return [...opts, ...NON_PROPERTY_BUCKETS];
  }, [properties, task, prefill]);

  const [draft, setDraft] = useState(() => {
    const base = task
      ? { ...task, startDate: toISO(parseDate(task.startDate)) }
      : { title: "", property: propertyOptions[0] || "", type: TYPES[0], startDate: todayISO(), status: "To Start", notes: "", reportedBy: "", assignedTo: "", priority: false, unit: "", ...prefill };
    if (!task && !base.assignedTo) {
      const rec = recommendContractor(contacts, base.property, base.type);
      if (rec) return { ...base, assignedTo: rec };
    }
    return base;
  });
  // Tracks whether "assigned to" is still just our suggestion (fair game to
  // update as property/type change) vs. something the user actually chose.
  const [autoAssigned, setAutoAssigned] = useState(() => !task && !prefill?.assignedTo);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  // Changing property/type suggests the right specialist automatically —
  // but never overwrites an assignee you've already picked or typed.
  const setTypeOrProperty = (key, value) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === "property" && next.property !== d.property) next.unit = "";
      if (autoAssigned) {
        const rec = recommendContractor(contacts, next.property, next.type);
        next.assignedTo = rec || "";
      }
      return next;
    });
  };
  const unitOptions = useMemo(() => units.filter((u) => u.property === draft.property), [units, draft.property]);
  const assignOptions = useMemo(
    () => Array.from(new Set([...contacts.map((c) => c.name), ...ASSIGNABLE_STAFF])).sort(),
    [contacts]
  );
  const valid = draft.title.trim().length > 0;
  const field = "w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300";
  const selectField = "w-full rounded-md border border-white/40 bg-slate-950 pl-3 pr-8 py-2 text-sm text-white focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300";
  const lbl = "block text-xs font-semibold text-slate-300 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="mt-10 w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <h3 className="text-sm font-semibold text-white">{task ? "Edit task" : "Add task"}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className={lbl}>Task</label>
            <textarea className={field} rows={2} value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="What needs doing?" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Property</label>
              <select className={selectField} value={draft.property} onChange={(e) => setTypeOrProperty("property", e.target.value)}>
                {propertyOptions.map((p) => <option key={p} value={p}>{propertyLabel(p, propertyLabels)}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Type</label>
              <select className={selectField} value={draft.type} onChange={(e) => setTypeOrProperty("type", e.target.value)}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            {unitOptions.length > 0 ? (
              <div className="col-span-2">
                <label className={lbl}>Unit <span className="font-normal text-slate-500">(optional — leave blank for whole-property)</span></label>
                <select className={selectField} value={draft.unit} onChange={(e) => set("unit", e.target.value)}>
                  <option value="">Whole property</option>
                  {unitOptions.map((u) => <option key={u.id} value={u.label}>{u.label}</option>)}
                </select>
              </div>
            ) : null}
            <div>
              <label className={lbl}>Reported by</label>
              <Combobox field={field} options={STAFF} value={draft.reportedBy} onChange={(v) => set("reportedBy", v)} placeholder="Who flagged it?" />
            </div>
            <div>
              <label className={lbl}>Assigned to</label>
              <Combobox field={field} options={assignOptions} value={draft.assignedTo}
                onChange={(v) => { set("assignedTo", v); setAutoAssigned(false); }} placeholder="Who's fixing it?" />
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select className={selectField} value={draft.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Start date</label>
              <input type="date" className={field} value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-500 bg-slate-950 text-white focus:ring-slate-300"
              checked={!!draft.priority} onChange={(e) => set("priority", e.target.checked)} />
            <Flag size={14} className={draft.priority ? "text-red-400" : "text-slate-500"} /> Priority
          </label>
          <div>
            <label className={lbl}>Notes</label>
            <textarea className={field} rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Context, updates, links…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">Cancel</button>
          <button type="button" disabled={!valid || saving} onClick={() => onSave(draft)}
            className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-40">
            {saving ? <Loader2 className="animate-spin" size={15} /> : null}
            {task ? "Save changes" : "Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactModal({ contact, property, prefillRole, propertyLabels, onSave, onClose, saving }) {
  const [draft, setDraft] = useState(contact || { property, name: "", role: prefillRole || "", phone: "", email: "", notes: "" });
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = draft.name.trim().length > 0;
  const field = "w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300";
  const lbl = "block text-xs font-semibold text-slate-300 mb-1";
  const allProps = draft.property === ALL_PROPERTIES;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="mt-10 w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <h3 className="text-sm font-semibold text-white">{contact ? "Edit contact" : "Add contact"} <span className="font-normal text-slate-400">· {allProps ? ALL_PROPERTIES : propertyLabel(property, propertyLabels)}</span></h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className={lbl}>Name</label>
            <input className={field} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Mike's Plumbing" autoFocus />
          </div>
          <div>
            <label className={lbl}>Role / trade</label>
            <Combobox field={field} options={CONTACT_ROLES} value={draft.role} onChange={(v) => set("role", v)} placeholder="Plumber, Electrician…" />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-500 bg-slate-950 text-white focus:ring-slate-300"
              checked={allProps} onChange={(e) => set("property", e.target.checked ? ALL_PROPERTIES : property)} />
            Covers all properties
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Phone</label>
              <input className={field} value={draft.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(415) 555-0100" />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input className={field} type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" />
            </div>
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea className={field} rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Rates, availability…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">Cancel</button>
          <button type="button" disabled={!valid || saving} onClick={() => onSave(draft)}
            className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-40">
            {saving ? <Loader2 className="animate-spin" size={15} /> : null}
            {contact ? "Save changes" : "Add contact"}
          </button>
        </div>
      </div>
    </div>
  );
}

function KeyDateModal({ keyDate, properties, propertyLabels, onSave, onClose, saving }) {
  const [draft, setDraft] = useState(keyDate || { property: "", title: "", month: 1, day: 1, notes: "" });
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = draft.title.trim().length > 0;
  const field = "w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300";
  const selectField = "w-full rounded-md border border-white/40 bg-slate-950 pl-3 pr-8 py-2 text-sm text-white focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300";
  const lbl = "block text-xs font-semibold text-slate-300 mb-1";
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="mt-10 w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <h3 className="text-sm font-semibold text-white">{keyDate ? "Edit key date" : "Add key date"}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className={lbl}>Title</label>
            <input className={field} value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Property tax installment due" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Month</label>
              <select className={selectField} value={draft.month} onChange={(e) => set("month", Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Day</label>
              <select className={selectField} value={draft.day} onChange={(e) => set("day", Number(e.target.value))}>
                {days.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Property (optional)</label>
            <select className={selectField} value={draft.property || ""} onChange={(e) => set("property", e.target.value)}>
              <option value="">All properties / company-wide</option>
              {properties.map((p) => <option key={p.key} value={p.key}>{propertyLabel(p.key, propertyLabels)}</option>)}
              {NON_PROPERTY_BUCKETS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea className={field} rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Amount, filing link, context…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">Cancel</button>
          <button type="button" disabled={!valid || saving} onClick={() => onSave(draft)}
            className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-40">
            {saving ? <Loader2 className="animate-spin" size={15} /> : null}
            {keyDate ? "Save changes" : "Add key date"}
          </button>
        </div>
      </div>
    </div>
  );
}

const DATE_PRESETS = [
  { key: "all", label: "All time" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "thisWeek", label: "This week" },
  { key: "lastWeek", label: "Last week" },
  { key: "thisMonth", label: "This month" },
  { key: "custom", label: "Custom range" },
];

function presetRange(key) {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const startOfWeek = (d) => { const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; const r = new Date(d); r.setDate(d.getDate() + diff); return r; };
  if (key === "7d") { const from = new Date(today); from.setDate(from.getDate() - 6); return { from: iso(from), to: iso(today) }; }
  if (key === "30d") { const from = new Date(today); from.setDate(from.getDate() - 29); return { from: iso(from), to: iso(today) }; }
  if (key === "thisWeek") { const from = startOfWeek(today); const to = new Date(from); to.setDate(to.getDate() + 6); return { from: iso(from), to: iso(to) }; }
  if (key === "lastWeek") { const from = startOfWeek(today); from.setDate(from.getDate() - 7); const to = new Date(from); to.setDate(to.getDate() + 6); return { from: iso(from), to: iso(to) }; }
  if (key === "thisMonth") { const from = new Date(today.getFullYear(), today.getMonth(), 1); const to = new Date(today.getFullYear(), today.getMonth() + 1, 0); return { from: iso(from), to: iso(to) }; }
  return { from: "", to: "" };
}

// Builds a plain-text rundown grouped by property, honoring every active
// filter — the thing you'd paste into a status update or message.
function buildReportText(tasks, f, labels) {
  const fromDate = f.from ? new Date(f.from + "T00:00:00") : null;
  const toDate = f.to ? new Date(f.to + "T23:59:59") : null;
  const filtered = tasks.filter((t) => {
    if (f.property !== "all" && t.property !== f.property) return false;
    if (f.assignedTo !== "all" && t.assignedTo !== f.assignedTo) return false;
    if (f.reportedBy !== "all" && t.reportedBy !== f.reportedBy) return false;
    if (f.state === "open" && stateOf(t.status) === "Done") return false;
    if (f.state === "done" && stateOf(t.status) !== "Done") return false;
    if (fromDate || toDate) {
      const d = parseDate(t.startDate);
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
    }
    return true;
  });

  const filterBits = [];
  if (f.from || f.to) filterBits.push(f.from && f.to ? `${f.from} to ${f.to}` : f.from ? `from ${f.from}` : `through ${f.to}`);
  if (f.property !== "all") filterBits.push(propertyLabel(f.property, labels));
  if (f.assignedTo !== "all") filterBits.push(`assigned to ${f.assignedTo}`);
  if (f.reportedBy !== "all") filterBits.push(`reported by ${f.reportedBy}`);
  if (f.state !== "all") filterBits.push(f.state === "open" ? "open only" : "done only");

  const byProp = new Map();
  for (const t of filtered) {
    if (!byProp.has(t.property)) byProp.set(t.property, []);
    byProp.get(t.property).push(t);
  }

  const openCount = filtered.filter((t) => stateOf(t.status) !== "Done").length;
  const doneCount = filtered.length - openCount;

  const lines = [
    "BAY HOMES — TASK REPORT",
    filterBits.length ? filterBits.join(" · ") : "All tasks",
    `Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · ${filtered.length} task${filtered.length === 1 ? "" : "s"} (${openCount} open, ${doneCount} done)`,
    "",
  ];
  if (filtered.length === 0) lines.push("No tasks match these filters.");
  for (const [prop, items] of byProp) {
    const sorted = [...items].sort((a, b) => {
      const aDone = stateOf(a.status) === "Done", bDone = stateOf(b.status) === "Done";
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (!!b.priority !== !!a.priority) return b.priority ? 1 : -1;
      return 0;
    });
    const heading = `${propertyLabel(prop, labels)} (${items.length})`;
    lines.push(heading);
    lines.push("-".repeat(heading.length));
    for (const t of sorted) {
      const done = stateOf(t.status) === "Done";
      const box = done ? "[x]" : "[ ]";
      const star = !done && t.priority ? " *" : "";
      const unitTag = t.unit ? ` [${t.unit}]` : "";
      const who = t.assignedTo ? ` -> ${t.assignedTo}` : "";
      const reported = t.reportedBy ? ` (reported by ${t.reportedBy})` : "";
      lines.push(`${box}${star} ${t.title}${unitTag}${who}${reported}`);
      if (t.notes) lines.push(`    ${t.notes.replace(/\n/g, " ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function ReportModal({ tasks, contacts, properties, propertyLabels, onClose }) {
  const [preset, setPreset] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [property, setProperty] = useState("all");
  const [assignedTo, setAssignedTo] = useState("all");
  const [reportedBy, setReportedBy] = useState("all");
  const [state, setState] = useState("all");
  const [copied, setCopied] = useState(false);

  const applyPreset = (key) => {
    setPreset(key);
    if (key !== "custom") { const r = presetRange(key); setFrom(r.from); setTo(r.to); }
  };

  // Contractors are exactly the vendor directory — nothing else counts,
  // so this list survives even if tasks get wiped.
  const assignees = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.name).filter(Boolean))).sort(),
    [contacts]
  );
  const reporters = useMemo(() => {
    const set = new Set(STAFF);
    tasks.forEach((t) => { if (t.reportedBy) set.add(t.reportedBy); });
    return Array.from(set).sort();
  }, [tasks]);

  const text = useMemo(
    () => buildReportText(tasks, { from, to, property, assignedTo, reportedBy, state }, propertyLabels),
    [tasks, from, to, property, assignedTo, reportedBy, state, propertyLabels]
  );

  const field = "w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300";
  const selectField = "w-full rounded-md border border-white/40 bg-slate-950 pl-3 pr-8 py-2 text-sm text-white focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300";
  const lbl = "block text-xs font-semibold text-slate-300 mb-1";

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard permission denied — user can still select & copy manually */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="mt-10 w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white"><FileText size={16} /> Report</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Date range</label>
              <select className={selectField} value={preset} onChange={(e) => applyPreset(e.target.value)}>
                {DATE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>State</label>
              <select className={selectField} value={state} onChange={(e) => setState(e.target.value)}>
                <option value="all">All</option>
                <option value="open">Open only</option>
                <option value="done">Done only</option>
              </select>
            </div>
          </div>
          {preset === "custom" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>From</label>
                <input type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>To</label>
                <input type="date" className={field} value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Which units</label>
              <select className={selectField} value={property} onChange={(e) => setProperty(e.target.value)}>
                <option value="all">All properties</option>
                {properties.map((p) => <option key={p.key} value={p.key}>{propertyLabel(p.key, propertyLabels)}</option>)}
                {NON_PROPERTY_BUCKETS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Which contractor / assignee</label>
              <select className={selectField} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="all">Anyone</option>
                {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Whose complaints / who flagged it</label>
              <select className={selectField} value={reportedBy} onChange={(e) => setReportedBy(e.target.value)}>
                <option value="all">Anyone</option>
                {reporters.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className={lbl.replace("mb-1", "mb-0")}>Text</label>
              <button type="button" onClick={copy}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white">
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <textarea readOnly value={text} rows={10}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 focus:outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">Close</button>
          <button type="button" onClick={() => downloadFile(`bay-homes-report-${from || "all"}-to-${to || "all"}.txt`, text, "text/plain")}
            className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200">
            <Download size={15} /> Download
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Properties manager -------------------------- */

function PropertyRow({ p, usedKeys, onSave, onDelete }) {
  const [label, setLabel] = useState(p.label);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const dirty = label !== p.label;
  const inUse = usedKeys.has(p.key);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
      <input value={label} onChange={(e) => setLabel(e.target.value)}
        onBlur={() => { if (dirty && label.trim()) onSave(p.key, { label: label.trim() }); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300" />
      <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-300">
        <input type="checkbox" checked={p.is_active} onChange={(e) => onSave(p.key, { is_active: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-slate-500 bg-slate-950 text-white focus:ring-slate-300" />
        Active
      </label>
      {confirmingDelete ? (
        <button type="button" onClick={() => onDelete(p.key)}
          className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/15">Confirm?</button>
      ) : (
        <button type="button" disabled={inUse} onClick={() => setConfirmingDelete(true)}
          title={inUse ? "In use — deactivate instead of deleting" : "Delete"}
          className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function DisplayNameModal({ currentName, onSave, onClose, saving }) {
  const [name, setName] = useState(currentName || "");
  const valid = name.trim().length > 0;
  const field = "w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="mt-10 w-full max-w-xs rounded-2xl bg-slate-900 border border-slate-700 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <h3 className="text-sm font-semibold text-white">Your display name</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-5 py-4">
          <label className="mb-1 block text-xs font-semibold text-slate-300">Shown to the whole team</label>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && valid) onSave(name); }}
            placeholder="e.g. Mariam" autoFocus />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">Cancel</button>
          <button type="button" disabled={!valid || saving} onClick={() => onSave(name)}
            className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-40">
            {saving ? <Loader2 className="animate-spin" size={15} /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function PropertiesManagerModal({ properties, usedKeys, onSave, onAdd, onDelete, onClose, saving }) {
  const [newName, setNewName] = useState("");
  const sorted = useMemo(() => [...properties].sort((a, b) => a.sort_order - b.sort_order), [properties]);
  const submitAdd = () => { const name = newName.trim(); if (name) { onAdd(name); setNewName(""); } };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="mt-10 w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white"><Settings size={15} /> Manage properties</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-2 px-5 py-4">
          {sorted.map((p) => <PropertyRow key={p.key} p={p} usedKeys={usedKeys} onSave={onSave} onDelete={onDelete} />)}
          {sorted.length === 0 ? <p className="text-xs font-medium text-slate-500">No properties yet — add your first one below.</p> : null}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-700 px-5 py-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); }}
            placeholder="New property name…"
            className="flex-1 rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300" />
          <button type="button" onClick={submitAdd} disabled={!newName.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-40">
            <Plus size={15} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Units --------------------------------- */

function UnitModal({ unit, property, propertyLabels, onSave, onClose, saving }) {
  const [draft, setDraft] = useState(unit || { property, label: "", sqft: "", tenant: "", furniture: "", paint_color: "", notes: "" });
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = draft.label.trim().length > 0;
  const field = "w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300";
  const lbl = "block text-xs font-semibold text-slate-300 mb-1";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="mt-10 w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <h3 className="text-sm font-semibold text-white">{unit ? "Edit unit" : "Add unit"} <span className="font-normal text-slate-400">· {propertyLabel(property, propertyLabels)}</span></h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Unit label</label>
              <input className={field} value={draft.label} onChange={(e) => set("label", e.target.value)} placeholder="e.g. 900A" autoFocus />
            </div>
            <div>
              <label className={lbl}>Sqft</label>
              <input className={field} type="number" value={draft.sqft ?? ""} onChange={(e) => set("sqft", e.target.value)} placeholder="e.g. 600" />
            </div>
          </div>
          <div>
            <label className={lbl}>Tenant(s)</label>
            <input className={field} value={draft.tenant} onChange={(e) => set("tenant", e.target.value)} placeholder="Who lives here" />
          </div>
          <div>
            <label className={lbl}>Furniture</label>
            <textarea className={field} rows={2} value={draft.furniture} onChange={(e) => set("furniture", e.target.value)} placeholder="Bed, dresser, sofa…" />
          </div>
          <div>
            <label className={lbl}>Paint color</label>
            <input className={field} value={draft.paint_color} onChange={(e) => set("paint_color", e.target.value)} placeholder="e.g. Swiss Coffee" />
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea className={field} rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything else…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">Cancel</button>
          <button type="button" disabled={!valid || saving}
            onClick={() => onSave({ ...draft, property, label: draft.label.trim(), sqft: draft.sqft === "" || draft.sqft === null ? null : Number(draft.sqft) })}
            className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-40">
            {saving ? <Loader2 className="animate-spin" size={15} /> : null}
            {unit ? "Save changes" : "Add unit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UnitsView({ properties, propertyLabels, units, tasks, onSaveUnit, onDeleteUnit, savingUnit }) {
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [editingUnit, setEditingUnit] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const sortedProps = useMemo(
    () => [...properties].filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [properties]
  );
  const propUnits = useMemo(() => units.filter((u) => u.property === selectedProperty), [units, selectedProperty]);

  const saveAndClose = async (draft) => {
    const ok = await onSaveUnit(draft);
    if (ok) { setModalOpen(false); setEditingUnit(null); }
  };

  if (!selectedProperty) {
    return (
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-300"><DoorOpen size={15} /> Units — pick a property</h2>
        {sortedProps.length === 0 ? (
          <p className="text-sm text-slate-500">No active properties yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sortedProps.map((p) => {
              const count = units.filter((u) => u.property === p.key).length;
              return (
                <button key={p.key} type="button" onClick={() => setSelectedProperty(p.key)}
                  className="text-left rounded-xl border border-slate-700 bg-slate-900 p-4 hover:border-slate-500">
                  <div className="flex min-w-0 items-center gap-2">
                    <Building2 size={15} className="shrink-0 text-slate-400" />
                    <span className="truncate text-sm font-semibold text-white">{propertyLabel(p.key, propertyLabels)}</span>
                  </div>
                  <div className="mt-3 text-xs font-medium text-slate-400">{count} unit{count === 1 ? "" : "s"}</div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setSelectedProperty(null)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white">
          <ArrowLeft size={15} /> {propertyLabel(selectedProperty, propertyLabels)}
        </button>
        <button type="button" onClick={() => { setEditingUnit(null); setModalOpen(true); }}
          className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-200">
          <Plus size={14} /> Add unit
        </button>
      </div>
      {propUnits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center text-sm text-slate-400">
          No units added yet for this property.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {propUnits.map((u) => {
            const openTaskCount = tasks.filter((t) => t.property === selectedProperty && t.unit === u.label && stateOf(t.status) !== "Done").length;
            return (
              <div key={u.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <button type="button" onClick={() => { setEditingUnit(u); setModalOpen(true); }} className="block w-full text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{u.label}</span>
                    {u.sqft ? <span className="text-xs font-medium text-slate-500">{u.sqft} sqft</span> : null}
                  </div>
                  {u.tenant ? <div className="mt-1.5 text-xs font-medium text-slate-300">{u.tenant}</div> : null}
                  {u.furniture || u.paint_color ? (
                    <div className="mt-2 flex flex-wrap gap-1 text-xs text-slate-500">
                      {u.paint_color ? <span className="rounded bg-slate-800 px-1.5 py-0.5">{u.paint_color}</span> : null}
                      {u.furniture ? <span className="max-w-[10rem] truncate rounded bg-slate-800 px-1.5 py-0.5">{u.furniture}</span> : null}
                    </div>
                  ) : null}
                  {u.notes ? <p className="mt-2 text-xs text-slate-500">{u.notes}</p> : null}
                  {openTaskCount ? <div className="mt-2 text-xs font-semibold text-amber-400">{openTaskCount} open task{openTaskCount === 1 ? "" : "s"}</div> : null}
                </button>
                <button type="button" onClick={() => onDeleteUnit(u.id)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-red-400">
                  <Trash2 size={12} /> Delete unit
                </button>
              </div>
            );
          })}
        </div>
      )}
      {modalOpen ? (
        <UnitModal unit={editingUnit} property={selectedProperty} propertyLabels={propertyLabels} saving={savingUnit}
          onSave={saveAndClose} onClose={() => { setModalOpen(false); setEditingUnit(null); }} />
      ) : null}
    </section>
  );
}

/* ---------------------------- Recheck timeline --------------------------- */

// A fixed schedule, not just a log of what happened — a checkpoint every 2
// working hours, advancing on its own whether or not anyone shows up. Past
// checkpoints that got no check-in read as missed; the current one pulses
// amber (or red once it's also overdue) until someone checks in.
const RECHECK_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
const RECHECK_INTERVAL_MINS = 120;

function timeAgoLabel(mins) {
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}
function formatHour(h) {
  const period = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${period}`;
}

// Ticks once a minute so the schedule keeps advancing even when nothing
// else on the page changes — a missed checkpoint has to show up on its
// own, not only after someone triggers a re-render.
function useClockTick(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function CheckInRail({ checkins, currentUser, onCheckIn, checkingIn, error, lastCheckin, minsSinceLast, overdue, cycleSkipped }) {
  const now = useClockTick();
  const checkpoints = useMemo(() => {
    const list = [];
    const nowDate = new Date(now);
    for (const h of RECHECK_HOURS) {
      const start = new Date(now); start.setHours(h, 0, 0, 0);
      if (start > nowDate) break; // stop at the first window that hasn't opened yet
      const end = new Date(start); end.setHours(end.getHours() + 2);
      const inWindow = checkins.filter((c) => { const t = new Date(c.checked_at); return t >= start && t < end; });
      list.push({ h, inWindow, current: nowDate < end });
    }
    return list;
  }, [checkins, now]);
  const currentWindowEndHour = checkpoints.length ? (checkpoints[checkpoints.length - 1].h + 2) % 24 : null;

  return (
    <aside className="hidden xl:flex sticky top-24 w-48 shrink-0 flex-col self-start rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-300"><Clock size={13} /> Recheck timeline</div>
      <div className="mb-4 text-xs font-medium text-slate-500">
        {lastCheckin ? `Last check ${timeAgoLabel(minsSinceLast)} ago` : "No checks yet today"}
      </div>

      <div className="flex flex-1 flex-col items-center overflow-y-auto py-1">
        {checkpoints.length === 0 ? (
          <div className="px-1 text-center text-[11px] text-slate-500">Schedule starts at {formatHour(RECHECK_HOURS[0])}</div>
        ) : null}
        {checkpoints.map((cp, i) => {
          const checked = cp.inWindow.length > 0;
          const missed = !cp.current && !checked;
          return (
            <div key={cp.h} className="flex flex-col items-center">
              {i > 0 ? <div className="w-px h-12 bg-slate-700" /> : null}
              <span className={
                "h-4 w-4 shrink-0 rounded-full border-2 " +
                (checked ? "border-emerald-400 bg-emerald-400"
                  : cp.current ? (overdue ? "border-red-500 animate-pulse" : "border-amber-400 animate-pulse")
                  : "border-red-500/70")
              } />
              <div className="mt-1.5 text-center text-[10px] font-medium text-slate-500">{formatHour(cp.h)}</div>
              {checked ? (
                <div className="max-w-[7rem] truncate text-center text-xs font-semibold text-emerald-300">{cp.inWindow.map((c) => c.person).join(", ")}</div>
              ) : cp.current ? (
                <div className={"text-center text-xs font-semibold " + (overdue ? "text-red-400" : "text-amber-400")}>Check now</div>
              ) : missed ? (
                <div className="text-center text-xs font-semibold text-red-400/80">Missed</div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mb-3 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-[11px] leading-snug text-slate-400">
        Also check <span className="text-slate-300">email</span>, <span className="text-slate-300">SMS</span>, and{" "}
        <span className="text-slate-300">Hospitable</span> for new messages.
      </div>

      {error ? <div className="mb-2 text-center text-[11px] font-medium text-red-400">{error}</div> : null}
      <button type="button" onClick={onCheckIn} disabled={!currentUser || checkingIn || (!cycleSkipped && lastCheckin?.person === currentUser)}
        className="flex items-center justify-center gap-1.5 rounded-md bg-white px-2 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-40">
        {checkingIn ? <Loader2 className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}
        {!cycleSkipped && lastCheckin?.person === currentUser ? "Waiting on someone else" : currentUser ? `Check in as ${currentUser}` : "Sign in to check in"}
      </button>
      {currentWindowEndHour !== null ? (
        <div className="mt-1.5 text-center text-[10px] text-slate-600">Late is fine — counts until {formatHour(currentWindowEndHour)}</div>
      ) : null}
    </aside>
  );
}

/* ------------------------------- Task row ------------------------------- */

function TaskRow({ t, open, onToggleOpen, onQuickDone, onQuickInProgress, onTogglePriority, onSetStatus, onEdit, onDelete, showProperty, propertyLabels, calls, onAddCall, onToggleCall, onDeleteCall }) {
  const st = stateOf(t.status);
  const meta = STATE_META[st];
  const age = daysSince(t.startDate);
  const isStale = st !== "Done" && age !== null && age >= STALE_DAYS;
  const done = st === "Done";
  const inProgress = t.status === "On Going";
  const [callInput, setCallInput] = useState("");
  const [callFieldOpen, setCallFieldOpen] = useState(false);
  const submitCall = () => { const text = callInput.trim(); if (text) { onAddCall(text); setCallInput(""); } };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden" style={{ borderLeftColor: meta.color, borderLeftWidth: 4 }}>
      <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-800/60" onClick={onToggleOpen}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={"text-sm font-semibold " + (done ? "text-slate-500 line-through" : "text-white")}>{t.title}</span>
            {isStale ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-500/40">
                <Clock size={11} /> {age}d !
              </span>
            ) : null}
            {calls.some((c) => !c.called) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/40">
                <PhoneCall size={11} /> {calls.filter((c) => !c.called).length} to call
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-400">
            {showProperty ? (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                {propertyLabel(t.property, propertyLabels)}{t.unit ? ` · ${t.unit}` : ""}
              </span>
            ) : t.unit ? (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{t.unit}</span>
            ) : null}
            <span className="rounded px-1.5 py-0.5 font-semibold" style={{ color: meta.color, backgroundColor: meta.color + "1a", boxShadow: `inset 0 0 0 1px ${meta.color}55` }}>{t.status}</span>
            {t.reportedBy ? <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">Flagged by {t.reportedBy}</span> : null}
            {t.assignedTo ? <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-blue-300">Fixing: {t.assignedTo}</span> : null}
          </div>
        </div>

        <button type="button" onClick={(e) => { e.stopPropagation(); onQuickDone(t); }}
          title={done ? "Mark not done" : "Mark complete"}
          className={
            "shrink-0 inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-colors " +
            (done
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
              : "border-slate-500 bg-slate-800 text-slate-100 hover:border-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300")
          }>
          <CheckCircle2 size={14} fill={done ? "currentColor" : "none"} /> {done ? "Done" : "Complete"}
        </button>
        {!done ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onQuickInProgress(t); }}
            title={inProgress ? "Back to To Start" : "Mark in progress"}
            className={
              "shrink-0 inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-colors " +
              (inProgress
                ? "border-blue-500/40 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25"
                : "border-slate-500 bg-slate-800 text-slate-100 hover:border-blue-400 hover:bg-blue-500/20 hover:text-blue-300")
            }>
            <PlayCircle size={14} fill={inProgress ? "currentColor" : "none"} /> {inProgress ? "In Progress" : "Start"}
          </button>
        ) : null}
        <button type="button" onClick={(e) => { e.stopPropagation(); onTogglePriority(t.id, !t.priority); }}
          className={"shrink-0 rounded p-1 " + (t.priority ? "text-red-400" : "text-slate-600 hover:text-slate-400")}
          title={t.priority ? "Unmark priority" : "Mark priority"}>
          <Flag size={16} fill={t.priority ? "currentColor" : "none"} />
        </button>
        <span className="shrink-0 text-slate-500">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </div>

      {open ? (
        <div className="border-t border-slate-700 bg-slate-950 px-4 py-3 space-y-3 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 font-medium text-slate-400">
            <span>Category: <span className="text-slate-200">{t.type}</span></span>
            <span>Reported by: <span className="text-slate-200">{t.reportedBy || "—"}</span></span>
            {t.createdBy ? <span>Added by: <span className="text-slate-200">{t.createdBy}</span></span> : null}
            {t.startDate ? <span>Date: <span className="text-slate-200">{formatDateDisplay(t.startDate)}</span></span> : null}
          </div>
          {t.notes ? <p className="whitespace-pre-wrap rounded-md bg-slate-900 p-2.5 leading-relaxed text-slate-300">{t.notes}</p> : null}

          {calls.length > 0 || callFieldOpen ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-slate-500">Calls to make</span>
                {calls.length === 0 ? (
                  <button type="button" onClick={() => setCallFieldOpen(false)} title="Never mind"
                    className="text-slate-600 hover:text-red-400"><X size={13} /></button>
                ) : null}
              </div>
              {calls.length > 0 ? (
                <div className="mb-2 space-y-1">
                  {calls.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5">
                      <input type="checkbox" checked={c.called} onChange={(e) => onToggleCall(c.id, e.target.checked)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-slate-500 bg-slate-950 text-white focus:ring-slate-300" />
                      <span className={"flex-1 " + (c.called ? "text-slate-500 line-through" : "text-slate-200")}>{c.text}</span>
                      <button type="button" onClick={() => onDeleteCall(c.id)} className="shrink-0 text-slate-600 hover:text-red-400"><X size={12} /></button>
                    </label>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-1.5">
                <input value={callInput} onChange={(e) => setCallInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitCall(); }}
                  placeholder="Add someone to call…" autoFocus={callFieldOpen && calls.length === 0}
                  className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300" />
                <button type="button" onClick={submitCall} disabled={!callInput.trim()}
                  className="rounded-md bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-600 disabled:opacity-40">Add</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setCallFieldOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-300">
              <PhoneCall size={12} /> Need calls made for this?
            </button>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <select value={t.status} onChange={(e) => onSetStatus(t.id, e.target.value)}
              className="rounded-md border border-white/40 bg-slate-900 pl-2 pr-7 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400"
              style={{ color: meta.color }}>
              {STATUSES.map((s) => <option key={s} value={s} style={{ color: "#f1f5f9", backgroundColor: "#0f172a" }}>{s}</option>)}
            </select>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => onEdit(t)} className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" title="Edit"><Pencil size={15} /></button>
              <button type="button" onClick={() => onDelete(t.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-500/15 hover:text-red-400" title="Delete"><Trash2 size={15} /></button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------- Tracker ------------------------------- */

export default function Tracker({ session, onSignOut }) {
  const [tasks, setTasks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [view, setView] = useState("tasks"); // tasks | units
  const [propertiesModalOpen, setPropertiesModalOpen] = useState(false);
  const [savingProperty, setSavingProperty] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);

  const [stateFilter, setStateFilter] = useState("open"); // open | all | stale | <state>
  const [propFilter, setPropFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("newestAdded"); // newestAdded | oldestAdded | dateAsc | dateDesc

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [addPrefill, setAddPrefill] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [savingContact, setSavingContact] = useState(false);
  const [contactCategory, setContactCategory] = useState(null);

  const [checklist, setChecklist] = useState([]);
  const [checklistInput, setChecklistInput] = useState("");
  const [savingChecklist, setSavingChecklist] = useState(false);

  const [taskCalls, setTaskCalls] = useState([]);

  const [keyDates, setKeyDates] = useState([]);
  const [keyDateModalOpen, setKeyDateModalOpen] = useState(false);
  const [editingKeyDate, setEditingKeyDate] = useState(null);
  const [savingKeyDate, setSavingKeyDate] = useState(false);
  const [showAllKeyDates, setShowAllKeyDates] = useState(false);
  const keyDatesScrollRef = useRef(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Who's using this — pulled straight from the logged-in session rather
  // than asking, since signing in already answers that. A shared login
  // (e.g. info@bayhomes.co) can still set a real display name via the
  // "people" table, so it's not stuck showing the raw email forever.
  const [people, setPeople] = useState([]);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const currentUser = useMemo(() => {
    const email = session?.user?.email;
    const custom = people.find((p) => p.email === email)?.display_name;
    return custom || nameFromEmail(email);
  }, [session, people]);
  const [checkins, setCheckins] = useState([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinError, setCheckinError] = useState(null);
  const checkinNow = useClockTick();
  const lastCheckin = useMemo(
    () => (checkins.length ? checkins.reduce((a, b) => (new Date(a.checked_at) > new Date(b.checked_at) ? a : b)) : null),
    [checkins]
  );
  const minsSinceLastCheckin = useMemo(
    () => (lastCheckin ? Math.round((checkinNow - new Date(lastCheckin.checked_at).getTime()) / 60000) : null),
    [lastCheckin, checkinNow]
  );
  const checkinOverdue = minsSinceLastCheckin === null || minsSinceLastCheckin >= RECHECK_INTERVAL_MINS;
  const checkinCycleSkipped = minsSinceLastCheckin !== null && minsSinceLastCheckin >= RECHECK_INTERVAL_MINS * 2;

  // Picking a different property starts the category drill-down over.
  useEffect(() => { setContactCategory(null); setChecklistInput(""); }, [propFilter]);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (error) { setError(error.message); return; }
    setError(null);
    setTasks((data || []).map(fromRow));
  }, []);

  const fetchContacts = useCallback(async () => {
    const { data, error } = await supabase.from("contacts").select("*").order("name", { ascending: true });
    if (error) return; // contacts table may not exist yet until the migration runs
    setContacts(data || []);
  }, []);

  const fetchChecklist = useCallback(async () => {
    const { data, error } = await supabase.from("checklist_items").select("*").order("created_at", { ascending: true });
    if (error) return; // checklist_items table may not exist yet until the migration runs
    setChecklist(data || []);
  }, []);

  const fetchTaskCalls = useCallback(async () => {
    const { data, error } = await supabase.from("task_calls").select("*").order("created_at", { ascending: true });
    if (error) return; // task_calls table may not exist yet until the migration runs
    setTaskCalls(data || []);
  }, []);

  const fetchKeyDates = useCallback(async () => {
    const { data, error } = await supabase.from("key_dates").select("*").order("title", { ascending: true });
    if (error) return; // key_dates table may not exist yet until the migration runs
    setKeyDates(data || []);
  }, []);

  const fetchProperties = useCallback(async () => {
    const { data, error } = await supabase.from("properties").select("*").order("sort_order", { ascending: true });
    if (error) return; // properties table may not exist yet until the migration runs
    setProperties(data || []);
  }, []);

  const fetchUnits = useCallback(async () => {
    const { data, error } = await supabase.from("units").select("*").order("label", { ascending: true });
    if (error) return; // units table may not exist yet until the migration runs
    setUnits(data || []);
  }, []);

  const fetchCheckins = useCallback(async () => {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { data, error } = await supabase.from("checkins").select("*").gte("checked_at", since.toISOString()).order("checked_at", { ascending: false });
    if (error) return; // checkins table may not exist yet until the migration runs
    setCheckins(data || []);
  }, []);

  const fetchPeople = useCallback(async () => {
    const { data, error } = await supabase.from("people").select("*");
    if (error) return; // people table may not exist yet until the migration runs
    setPeople(data || []);
  }, []);

  // Initial load.
  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchTasks();
      await Promise.all([fetchContacts(), fetchChecklist(), fetchTaskCalls(), fetchKeyDates(), fetchProperties(), fetchUnits(), fetchCheckins(), fetchPeople()]);
      setLoading(false);
    })();
  }, [fetchTasks, fetchContacts, fetchChecklist, fetchTaskCalls, fetchKeyDates, fetchProperties, fetchUnits, fetchCheckins, fetchPeople]);

  // Live updates from teammates + refetch when returning to the tab.
  useEffect(() => {
    const channel = supabase
      .channel("tasks-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchTasks())
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => fetchContacts())
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_items" }, () => fetchChecklist())
      .on("postgres_changes", { event: "*", schema: "public", table: "task_calls" }, () => fetchTaskCalls())
      .on("postgres_changes", { event: "*", schema: "public", table: "key_dates" }, () => fetchKeyDates())
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, () => fetchProperties())
      .on("postgres_changes", { event: "*", schema: "public", table: "units" }, () => fetchUnits())
      .on("postgres_changes", { event: "*", schema: "public", table: "checkins" }, () => fetchCheckins())
      .on("postgres_changes", { event: "*", schema: "public", table: "people" }, () => fetchPeople())
      .subscribe();
    const onFocus = () => { fetchTasks(); fetchContacts(); fetchChecklist(); fetchTaskCalls(); fetchKeyDates(); fetchProperties(); fetchUnits(); fetchCheckins(); fetchPeople(); };
    window.addEventListener("focus", onFocus);
    return () => { supabase.removeChannel(channel); window.removeEventListener("focus", onFocus); };
  }, [fetchTasks, fetchContacts, fetchChecklist, fetchTaskCalls, fetchKeyDates, fetchProperties, fetchUnits, fetchCheckins, fetchPeople]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTasks(), fetchContacts(), fetchChecklist(), fetchTaskCalls(), fetchKeyDates(), fetchProperties(), fetchUnits(), fetchCheckins(), fetchPeople()]);
    setRefreshing(false);
  };

  const checkIn = async () => {
    if (!currentUser) return;
    setCheckinError(null);
    // The point of the timeline is a second set of eyes — the same person
    // checking in twice in a row doesn't prove anything got re-reviewed.
    // But if a whole extra cycle goes by with nobody else stepping in, let
    // them do it anyway — something checked beats nothing checked.
    if (lastCheckin && lastCheckin.person === currentUser && !checkinCycleSkipped) {
      setCheckinError("You already checked in last — have someone else check in next.");
      return;
    }
    setCheckingIn(true);
    const { error } = await supabase.from("checkins").insert({ person: currentUser });
    if (error) setError(error.message + " (has the checkins table migration been run yet?)");
    await fetchCheckins();
    setCheckingIn(false);
  };

  const saveDisplayName = async (name) => {
    const email = session?.user?.email;
    if (!email || !name.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from("people").upsert({ email, display_name: name.trim() });
    if (error) setError(error.message + " (has the people table migration been run yet?)");
    await fetchPeople();
    setSavingName(false);
    setNameModalOpen(false);
  };

  const openAdd = (prefill) => { setEditing(null); setAddPrefill(prefill || null); setModalOpen(true); };
  const openEdit = (t) => { setEditing(t); setAddPrefill(null); setModalOpen(true); };

  const saveTask = async (task) => {
    setSaving(true);
    try {
      if (task.id) {
        const { error } = await supabase.from("tasks").update(toRow(task)).eq("id", task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert(toRow({ ...task, createdBy: currentUser }));
        if (error) throw error;
      }
      await fetchTasks();
      setModalOpen(false); setEditing(null); setAddPrefill(null);
    } catch (e) {
      setError(e.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async (id) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    await fetchTasks();
  };

  const setStatus = async (id, status) => {
    // optimistic, then reconcile
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) { setError(error.message); await fetchTasks(); }
  };
  const quickDone = (t) => setStatus(t.id, isDone(t) ? "To Start" : "Complete");
  const quickInProgress = (t) => setStatus(t.id, t.status === "On Going" ? "To Start" : "On Going");

  const togglePriority = async (id, priority) => {
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, priority } : x)));
    const { error } = await supabase.from("tasks").update({ priority }).eq("id", id);
    if (error) { setError(error.message); await fetchTasks(); }
  };

  const saveContact = async (contact) => {
    setSavingContact(true);
    try {
      if (contact.id) {
        const { id, created_at, updated_at, ...rest } = contact;
        const { error } = await supabase.from("contacts").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(contact);
        if (error) throw error;
      }
      await fetchContacts();
      setContactModalOpen(false); setEditingContact(null);
    } catch (e) {
      setError(e.message || "Could not save contact. Has the contacts table migration been run yet?");
    } finally {
      setSavingContact(false);
    }
  };

  const removeContact = async (id) => {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    await fetchContacts();
  };

  const addChecklistItem = async () => {
    const text = checklistInput.trim();
    if (!text || !contactCategory || propFilter === "all") return;
    setSavingChecklist(true);
    const { error } = await supabase.from("checklist_items").insert({ property: propFilter, category: contactCategory, text });
    if (error) setError(error.message + " (has the checklist_items migration been run yet?)");
    else setChecklistInput("");
    await fetchChecklist();
    setSavingChecklist(false);
  };

  const toggleChecklistItem = async (id, checked) => {
    setChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, checked } : c)));
    const { error } = await supabase.from("checklist_items").update({ checked }).eq("id", id);
    if (error) { setError(error.message); await fetchChecklist(); }
  };

  const removeChecklistItem = async (id) => {
    const { error } = await supabase.from("checklist_items").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    await fetchChecklist();
  };

  const addTaskCall = async (taskId, text) => {
    const { error } = await supabase.from("task_calls").insert({ task_id: taskId, text });
    if (error) setError(error.message + " (has the task_calls migration been run yet?)");
    await fetchTaskCalls();
  };
  const toggleTaskCall = async (id, called) => {
    setTaskCalls((prev) => prev.map((c) => (c.id === id ? { ...c, called } : c)));
    const { error } = await supabase.from("task_calls").update({ called }).eq("id", id);
    if (error) { setError(error.message); await fetchTaskCalls(); }
  };
  const removeTaskCall = async (id) => {
    const { error } = await supabase.from("task_calls").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    await fetchTaskCalls();
  };

  const saveKeyDate = async (kd) => {
    setSavingKeyDate(true);
    try {
      const payload = { property: kd.property || "", title: kd.title, month: Number(kd.month), day: Number(kd.day), notes: kd.notes || "" };
      if (kd.id) {
        const { error } = await supabase.from("key_dates").update(payload).eq("id", kd.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("key_dates").insert(payload);
        if (error) throw error;
      }
      await fetchKeyDates();
      setKeyDateModalOpen(false); setEditingKeyDate(null);
    } catch (e) {
      setError(e.message || "Could not save key date. Has the key_dates migration been run yet?");
    } finally {
      setSavingKeyDate(false);
    }
  };
  const removeKeyDate = async (id) => {
    const { error } = await supabase.from("key_dates").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    await fetchKeyDates();
  };

  const addProperty = async (name) => {
    setSavingProperty(true);
    const sortOrder = properties.length ? Math.max(...properties.map((p) => p.sort_order)) + 1 : 1;
    const { error } = await supabase.from("properties").insert({ key: name, label: name, is_active: true, sort_order: sortOrder });
    if (error) setError(error.message + " (has the properties table migration been run yet?)");
    await fetchProperties();
    setSavingProperty(false);
  };
  const updateProperty = async (key, patch) => {
    setProperties((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
    const { error } = await supabase.from("properties").update(patch).eq("key", key);
    if (error) { setError(error.message); await fetchProperties(); }
  };
  const removeProperty = async (key) => {
    const { error } = await supabase.from("properties").delete().eq("key", key);
    if (error) { setError(error.message); return; }
    await fetchProperties();
  };
  // A property still referenced anywhere shouldn't be deletable outright —
  // deactivating hides it from nav/dropdowns without orphaning that data.
  const propertyKeysInUse = useMemo(() => {
    const set = new Set();
    tasks.forEach((t) => set.add(t.property));
    contacts.forEach((c) => set.add(c.property));
    keyDates.forEach((k) => k.property && set.add(k.property));
    checklist.forEach((c) => set.add(c.property));
    units.forEach((u) => set.add(u.property));
    return set;
  }, [tasks, contacts, keyDates, checklist, units]);

  const saveUnit = async (unit) => {
    setSavingUnit(true);
    let ok = true;
    try {
      if (unit.id) {
        const { id, created_at, updated_at, ...rest } = unit;
        const { error } = await supabase.from("units").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("units").insert(unit);
        if (error) throw error;
      }
      await fetchUnits();
    } catch (e) {
      setError(e.message || "Could not save unit. Has the units table migration been run yet?");
      ok = false;
    } finally {
      setSavingUnit(false);
    }
    return ok;
  };
  const removeUnit = async (id) => {
    const { error } = await supabase.from("units").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    await fetchUnits();
  };

  const propertyLabels = useMemo(() => Object.fromEntries(properties.map((p) => [p.key, p.label])), [properties]);
  const activeProperties = useMemo(
    () => properties.filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [properties]
  );

  /* ----- metrics ----- */
  const metrics = useMemo(() => {
    const byState = Object.fromEntries(STATES.map((s) => [s, 0]));
    const byProp = new Map(properties.map((p) => [p.key, { total: 0, open: 0, priority: 0, stale: 0 }]));
    let stale = 0, priority = 0;
    for (const t of tasks) {
      const st = stateOf(t.status);
      byState[st]++;
      if (!byProp.has(t.property)) byProp.set(t.property, { total: 0, open: 0, priority: 0, stale: 0 });
      const p = byProp.get(t.property);
      p.total++;
      if (st !== "Done") p.open++;
      const age = daysSince(t.startDate);
      const isStale = st !== "Done" && age !== null && age >= STALE_DAYS;
      if (isStale) { stale++; p.stale++; }
      if (t.priority && st !== "Done") { priority++; p.priority++; }
    }
    const done = byState["Done"];
    return {
      total: tasks.length, open: tasks.length - done, done,
      carrie: byState["Waiting on Carrie"], stale, priority,
      propStats: Array.from(byProp, ([name, s]) => ({ name, ...s })),
    };
  }, [tasks, properties]);

  const activeKeySet = useMemo(() => new Set(activeProperties.map((p) => p.key)), [activeProperties]);
  const propertyCards = metrics.propStats.filter((p) => activeKeySet.has(p.name));
  const propertyContacts = useMemo(
    () => contacts.filter((c) => c.property === propFilter || c.property === ALL_PROPERTIES),
    [contacts, propFilter]
  );
  const propertyChecklist = useMemo(() => checklist.filter((c) => c.property === propFilter), [checklist, propFilter]);

  const sortedKeyDates = useMemo(
    () => [...keyDates].sort((a, b) => daysUntil(a.month, a.day) - daysUntil(b.month, b.day)),
    [keyDates]
  );
  const upcomingKeyDates = useMemo(
    () => sortedKeyDates.filter((k) => daysUntil(k.month, k.day) <= KEY_DATE_ALERT_DAYS),
    [sortedKeyDates]
  );

  // Category pills for the selected property: the standard trade list plus
  // any custom category someone's already typed in for this property.
  const categoriesForProperty = useMemo(() => {
    const extra = new Set();
    propertyContacts.forEach((c) => { if (c.role && !CONTACT_ROLES.includes(c.role)) extra.add(c.role); });
    propertyChecklist.forEach((c) => { if (c.category && !CONTACT_ROLES.includes(c.category)) extra.add(c.category); });
    return [...CONTACT_ROLES.slice(0, -1), ...extra, CONTACT_ROLES[CONTACT_ROLES.length - 1]];
  }, [propertyContacts, propertyChecklist]);

  const contactsInCategory = useMemo(
    () => propertyContacts.filter((c) => (c.role || "Other") === contactCategory),
    [propertyContacts, contactCategory]
  );
  const checklistInCategory = useMemo(
    () => propertyChecklist.filter((c) => (c.category || "Other") === contactCategory),
    [propertyChecklist, contactCategory]
  );

  /* ----- filtering ----- */
  const passState = (t) => {
    const st = stateOf(t.status);
    if (stateFilter === "all") return true;
    if (stateFilter === "open") return st !== "Done";
    if (stateFilter === "stale") {
      const age = daysSince(t.startDate);
      return st !== "Done" && age !== null && age >= STALE_DAYS;
    }
    return st === stateFilter;
  };
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (!passState(t)) return false;
      if (propFilter !== "all" && t.property !== propFilter) return false;
      if (priorityFilter && !t.priority) return false;
      if (q && !(`${t.title} ${t.notes} ${t.property} ${t.reportedBy} ${t.assignedTo}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [tasks, stateFilter, propFilter, priorityFilter, query]);

  // Grouped by category — "everything plumbing", "everything electrical", etc.
  const groups = useMemo(() => {
    const map = new Map(TYPES.map((t) => [t, []]));
    for (const t of filtered) {
      if (!map.has(t.type)) map.set(t.type, []);
      map.get(t.type).push(t);
    }
    let result = Array.from(map, ([type, items]) => ({ type, items })).filter((g) => g.items.length > 0);
    if (sortBy === "newestAdded" || sortBy === "oldestAdded") {
      // Every task has a created_at, so this always has something to sort by.
      result = result.map(({ type, items }) => ({
        type,
        items: [...items].sort((a, b) => {
          const diff = new Date(a.createdAt) - new Date(b.createdAt);
          return sortBy === "oldestAdded" ? diff : -diff;
        }),
      }));
    } else if (sortBy === "dateAsc" || sortBy === "dateDesc") {
      // Due date — most tasks don't have one set, so those sink to the end.
      result = result.map(({ type, items }) => ({
        type,
        items: [...items].sort((a, b) => {
          const da = parseDate(a.startDate), db = parseDate(b.startDate);
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return sortBy === "dateAsc" ? da - db : db - da;
        }),
      }));
    }
    return result;
  }, [filtered, sortBy]);

  const toggleGroup = (type) => setCollapsedGroups((prev) => {
    const next = new Set(prev);
    next.has(type) ? next.delete(type) : next.add(type);
    return next;
  });

  const exportCsv = () => {
    const head = ["Task", "Property", "Type", "Start Date", "Status", "State", "Reported By", "Assigned To", "Priority", "Notes"];
    const rows = tasks.map((t) => [t.title, t.property, t.type, t.startDate, t.status, stateOf(t.status), t.reportedBy, t.assignedTo, t.priority ? "Yes" : "", t.notes]);
    downloadFile("bay-homes-tasks.csv", [head, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n"), "text/csv");
  };


  const anyFilter = stateFilter !== "open" || propFilter !== "all" || priorityFilter || query.trim() !== "";
  const clearFilters = () => { setStateFilter("open"); setPropFilter("all"); setPriorityFilter(false); setQuery(""); };
  const toggleState = (s) => setStateFilter((prev) => (prev === s ? "open" : s));
  const toggleProperty = (p) => setPropFilter((prev) => (prev === p ? "all" : p));

  const select = "rounded-md border border-white/40 bg-slate-900 pl-2.5 pr-8 py-2 text-sm font-medium text-slate-200 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-900 font-bold">BH</div>
            <h1 className="text-xl font-bold tracking-tight text-white">Bay Homes Ops Tracker</h1>
            <div className="ml-2 flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 p-0.5">
              <button type="button" onClick={() => setView("tasks")}
                className={"inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold " + (view === "tasks" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white")}>
                <ClipboardList size={14} /> Tasks
              </button>
              <button type="button" onClick={() => setView("units")}
                className={"inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold " + (view === "units" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white")}>
                <DoorOpen size={14} /> Units
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={refresh} title="Refresh" className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
            {view === "tasks" ? (
              <>
                <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                  <Download size={15} /> CSV
                </button>
                <button type="button" onClick={() => setReportModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                  <FileText size={15} /> Report
                </button>
                <button type="button" onClick={() => openAdd(propFilter !== "all" ? { property: propFilter } : null)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200">
                  <Plus size={16} /> Add task
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => setNameModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
              title={`${session?.user?.email || ""} — click to change your display name`}>
              <UserCircle2 size={15} className="text-slate-500" /> {currentUser || "Signed in"}
            </button>
            <button type="button" onClick={onSignOut} title="Sign out" className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-2.5 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[90rem] px-4 py-6">
        {error ? (
          <div className="flex items-center justify-between rounded-lg bg-red-500/15 px-4 py-3 text-sm font-medium text-red-300 ring-1 ring-inset ring-red-500/40">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-300 hover:text-red-200"><X size={16} /></button>
          </div>
        ) : null}

        {view === "units" ? (
          loading ? (
            <div className="flex h-64 items-center justify-center text-slate-500"><Loader2 className="animate-spin" size={22} /></div>
          ) : (
            <UnitsView properties={properties} propertyLabels={propertyLabels} units={units} tasks={tasks}
              onSaveUnit={saveUnit} onDeleteUnit={removeUnit} savingUnit={savingUnit} />
          )
        ) : (
        <div className="flex items-start gap-12">
        <div className="min-w-0 flex-1 max-w-6xl space-y-6">

        {!loading && checkinOverdue ? (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 ring-1 ring-inset ring-red-500/40">
            <Clock size={14} className="shrink-0" />
            {lastCheckin
              ? `Recheck overdue — last checked by ${lastCheckin.person} ${timeAgoLabel(minsSinceLastCheckin)} ago. Someone else should check the to-do list now.`
              : "No one has checked the to-do list today yet — check it now."}
          </div>
        ) : null}

        {!loading && upcomingKeyDates.length > 0 ? (
          <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300 ring-1 ring-inset ring-amber-500/40">
            <div className="mb-1 flex items-center gap-1.5 font-semibold"><Bell size={14} /> Coming up</div>
            <ul className="space-y-0.5">
              {upcomingKeyDates.map((k) => {
                const dLeft = daysUntil(k.month, k.day);
                return (
                  <li key={k.id}>
                    {k.title}{k.property ? ` — ${propertyLabel(k.property, propertyLabels)}` : ""} · {MONTHS[k.month - 1]} {k.day}
                    {" "}<span className="text-amber-400">({dLeft === 0 ? "today" : dLeft === 1 ? "tomorrow" : `in ${dLeft}d`})</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-500"><Loader2 className="animate-spin" size={22} /></div>
        ) : (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi label="Total" value={metrics.total} active={!anyFilter} onClick={clearFilters} />
              <Kpi label="Open" value={metrics.open} tone="slate" active={stateFilter === "open" && !anyFilter} onClick={clearFilters} />
              <Kpi label="Priority" value={metrics.priority} tone="red" icon={Flag}
                   active={priorityFilter} onClick={() => setPriorityFilter((p) => !p)} />
              <Kpi label="Waiting on Carrie" value={metrics.carrie} tone="amber" icon={UserCheck}
                   active={stateFilter === "Waiting on Carrie"} onClick={() => toggleState("Waiting on Carrie")} />
              <Kpi label={`! (${STALE_DAYS}+d)`} value={metrics.stale} tone="red" icon={AlertTriangle}
                   active={stateFilter === "stale"} onClick={() => toggleState("stale")} />
              <Kpi label="Done" value={metrics.done} tone="emerald" icon={CheckCircle2}
                   active={stateFilter === "Done"} onClick={() => toggleState("Done")} />
            </section>

            {/* Properties — primary navigation */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300">Properties</h2>
                <button type="button" onClick={() => setPropertiesModalOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white">
                  <Settings size={13} /> Manage
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {propertyCards.map((p) => {
                  const active = propFilter === p.name;
                  const contactCount = contacts.filter((c) => c.property === p.name || c.property === ALL_PROPERTIES).length;
                  return (
                    <button key={p.name} type="button" onClick={() => toggleProperty(p.name)}
                      className={
                        "text-left rounded-xl border p-4 transition " +
                        (active ? "border-white ring-1 ring-white bg-slate-800" : "border-slate-700 bg-slate-900 hover:border-slate-500")
                      }>
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 size={15} className="shrink-0 text-slate-400" />
                        <span className="truncate text-sm font-semibold text-white">{propertyLabel(p.name, propertyLabels)}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-400">
                        <span>{p.open} open</span>
                        {p.priority ? <span className="text-red-400">{p.priority} priority</span> : null}
                        {p.stale ? <span className="text-amber-400">{p.stale} !</span> : null}
                        {p.open === 0 ? <span className="text-emerald-400">All caught up</span> : null}
                        {contactCount ? <span className="flex items-center gap-1"><Users size={11} /> {contactCount}</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Key dates — recurring compliance calendar */}
            {keyDates.length > 0 ? (
              <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-300">
                    <Bell size={15} /> Key dates
                  </h2>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setShowAllKeyDates((v) => !v)}
                      className="text-xs font-semibold text-slate-400 hover:text-white">
                      {showAllKeyDates ? "Show upcoming only" : `Show all (${sortedKeyDates.length})`}
                    </button>
                    <button type="button" onClick={() => { setEditingKeyDate(null); setKeyDateModalOpen(true); }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white">
                      <Plus size={13} /> Add key date
                    </button>
                    <div className="flex items-center gap-1 border-l border-slate-700 pl-3">
                      <button type="button" onClick={() => keyDatesScrollRef.current?.scrollBy({ left: -200, behavior: "smooth" })}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" title="Scroll left"><ChevronLeft size={15} /></button>
                      <button type="button" onClick={() => keyDatesScrollRef.current?.scrollBy({ left: 200, behavior: "smooth" })}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" title="Scroll right"><ChevronRight size={15} /></button>
                    </div>
                  </div>
                </div>
                {!showAllKeyDates && upcomingKeyDates.length === 0 ? (
                  <p className="text-xs font-medium text-slate-500">Nothing due in the next {KEY_DATE_ALERT_DAYS} days.</p>
                ) : null}
                <div ref={keyDatesScrollRef} className="flex items-start gap-2 overflow-x-auto scroll-smooth pb-1 -mx-1 px-1">
                  {(showAllKeyDates ? sortedKeyDates : upcomingKeyDates).map((k) => {
                    const dLeft = daysUntil(k.month, k.day);
                    const soon = dLeft <= 7;
                    return (
                      <div key={k.id} className="flex w-48 shrink-0 flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2">
                        <div className="flex items-start justify-between gap-1">
                          <div className="text-sm font-medium leading-tight text-white">{k.title}</div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button type="button" onClick={() => { setEditingKeyDate(k); setKeyDateModalOpen(true); }} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white" title="Edit"><Pencil size={12} /></button>
                            <button type="button" onClick={() => removeKeyDate(k.id)} className="rounded p-1 text-slate-500 hover:bg-red-500/15 hover:text-red-400" title="Delete"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-slate-500">
                          <span>{MONTHS[k.month - 1]} {k.day}</span>
                          <span className={soon ? "text-red-400" : dLeft <= KEY_DATE_ALERT_DAYS ? "text-amber-400" : ""}>
                            {dLeft === 0 ? "today" : dLeft === 1 ? "tomorrow" : `in ${dLeft}d`}
                          </span>
                        </div>
                        {k.property ? <div className="text-xs text-slate-500">{propertyLabel(k.property, propertyLabels)}</div> : null}
                        {k.notes ? <p className="text-xs text-slate-400">{k.notes}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900 p-4 text-center">
                <p className="text-xs font-medium text-slate-500">No key dates yet — will show once the migration loads the compliance calendar, or add one manually.</p>
                <button type="button" onClick={() => { setEditingKeyDate(null); setKeyDateModalOpen(true); }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white">
                  <Plus size={13} /> Add key date
                </button>
              </section>
            )}

            {/* Contacts & checklists for the selected property — pick a category first */}
            {propFilter !== "all" && !NON_PROPERTY_BUCKETS.includes(propFilter) ? (
              <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-300">
                  <Users size={15} /> Contacts & checklists <span className="font-normal text-slate-500">· {propertyLabel(propFilter, propertyLabels)}</span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {categoriesForProperty.map((cat) => {
                    const count = propertyContacts.filter((c) => (c.role || "Other") === cat).length
                      + propertyChecklist.filter((c) => (c.category || "Other") === cat).length;
                    const active = contactCategory === cat;
                    return (
                      <button key={cat} type="button" onClick={() => setContactCategory(active ? null : cat)}
                        className={
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
                          (active ? "border-white bg-white text-slate-900" : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500")
                        }>
                        {cat}
                        {count ? <span className={"tabular-nums " + (active ? "text-slate-500" : "text-slate-500")}>{count}</span> : null}
                      </button>
                    );
                  })}
                </div>

                {contactCategory ? (
                  <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contacts — {contactCategory}</h3>
                        <button type="button" onClick={() => { setEditingContact(null); setContactModalOpen(true); }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white">
                          <Plus size={13} /> Add contact
                        </button>
                      </div>
                      {contactsInCategory.length === 0 ? (
                        <p className="text-xs font-medium text-slate-500">No contacts saved under {contactCategory} yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {contactsInCategory.map((c) => (
                            <div key={c.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white">{c.name}</div>
                                <div className="mt-1.5 flex flex-col gap-1 text-xs font-medium">
                                  {c.phone ? (
                                    <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 text-blue-300 hover:text-blue-200">
                                      <Phone size={12} /> {c.phone}
                                    </a>
                                  ) : null}
                                  {c.email ? (
                                    <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-blue-300 hover:text-blue-200">
                                      <Mail size={12} /> {c.email}
                                    </a>
                                  ) : null}
                                </div>
                                {c.notes ? <p className="mt-1.5 text-xs text-slate-400">{c.notes}</p> : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button type="button" onClick={() => { setEditingContact(c); setContactModalOpen(true); }} className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white" title="Edit"><Pencil size={13} /></button>
                                <button type="button" onClick={() => removeContact(c.id)} className="rounded p-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-400" title="Delete"><Trash2 size={13} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist — {contactCategory}</h3>
                      {checklistInCategory.length > 0 ? (
                        <div className="mb-2 space-y-1.5">
                          {checklistInCategory.map((item) => (
                            <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                              <input type="checkbox" checked={item.checked} onChange={(e) => toggleChecklistItem(item.id, e.target.checked)}
                                className="h-4 w-4 shrink-0 rounded border-slate-500 bg-slate-950 text-white focus:ring-slate-300" />
                              <span className={"flex-1 text-sm " + (item.checked ? "text-slate-500 line-through" : "text-slate-200")}>{item.text}</span>
                              <button type="button" onClick={() => removeChecklistItem(item.id)} className="shrink-0 text-slate-600 hover:text-red-400"><X size={14} /></button>
                            </label>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex gap-2">
                        <input value={checklistInput} onChange={(e) => setChecklistInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") addChecklistItem(); }}
                          placeholder={`Add a recurring ${contactCategory.toLowerCase()} checklist item…`}
                          className="flex-1 rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300" />
                        <button type="button" onClick={addChecklistItem} disabled={!checklistInput.trim() || savingChecklist}
                          className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-40">
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {/* Filters */}
            <section className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…"
                  className="w-56 rounded-md border border-slate-600 bg-slate-900 py-2 pl-8 pr-3 text-sm font-medium text-white placeholder-slate-500 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300" />
              </div>
              <select className={select} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                <option value="open">Open</option>
                <option value="all">Show all</option>
                <option value="Waiting on Carrie">Waiting on Carrie</option>
                <option value="stale">{`! (${STALE_DAYS}+ days)`}</option>
                <option value="Done">Done</option>
              </select>
              <select className={select} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="newestAdded">Newest added</option>
                <option value="oldestAdded">Oldest added</option>
                <option value="dateAsc">Due date — soonest first</option>
                <option value="dateDesc">Due date — latest first</option>
              </select>
              {propFilter !== "all" ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 pl-2.5 pr-1.5 py-1.5 text-sm font-medium text-slate-200">
                  {propertyLabel(propFilter, propertyLabels)}
                  <button type="button" onClick={() => setPropFilter("all")} className="rounded p-0.5 text-slate-400 hover:text-white"><X size={13} /></button>
                </span>
              ) : null}
              {anyFilter ? <button type="button" onClick={clearFilters} className="text-sm font-semibold text-slate-400 hover:text-white">Clear</button> : null}
              <span className="ml-auto text-sm font-medium text-slate-400">{filtered.length} of {tasks.length}</span>
            </section>

            {/* Task list, grouped by category */}
            <section className="space-y-5">
              {groups.length === 0 ? (
                <div className="relative rounded-xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center text-sm text-slate-400">
                  <button type="button" onClick={() => openAdd(propFilter !== "all" ? { property: propFilter } : null)}
                    className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-200">
                    <Plus size={14} /> Add task
                  </button>
                  No tasks match these filters. <button type="button" onClick={clearFilters} className="font-semibold text-white underline">Show everything</button>
                </div>
              ) : (
                groups.map(({ type, items }) => {
                  const collapsed = collapsedGroups.has(type);
                  return (
                    <div key={type}>
                      <div className="mb-2 flex items-center justify-between">
                        <button type="button" onClick={() => toggleGroup(type)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 hover:text-white">
                          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          {type} <span className="font-normal text-slate-500">({items.length})</span>
                        </button>
                        <button type="button"
                          onClick={() => openAdd({ type, property: propFilter !== "all" ? propFilter : (activeProperties[0]?.key || "") })}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white">
                          <Plus size={13} /> Add
                        </button>
                      </div>
                      {!collapsed ? (
                        <div className="space-y-2">
                          {items.map((t) => (
                            <TaskRow key={t.id} t={t} open={expanded === t.id}
                              onToggleOpen={() => setExpanded(expanded === t.id ? null : t.id)}
                              onQuickDone={quickDone} onQuickInProgress={quickInProgress} onTogglePriority={togglePriority}
                              onSetStatus={setStatus} onEdit={openEdit} onDelete={removeTask}
                              showProperty={propFilter === "all"} propertyLabels={propertyLabels}
                              calls={taskCalls.filter((c) => c.task_id === t.id)}
                              onAddCall={(text) => addTaskCall(t.id, text)}
                              onToggleCall={toggleTaskCall} onDeleteCall={removeTaskCall} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </section>

            <footer className="pt-2 pb-8 text-center text-xs font-medium text-slate-500">
              Live shared database · changes sync to everyone on the team in real time
            </footer>
          </>
        )}
        </div>
        {!loading ? (
          <CheckInRail checkins={checkins} currentUser={currentUser} onCheckIn={checkIn} checkingIn={checkingIn} error={checkinError}
            lastCheckin={lastCheckin} minsSinceLast={minsSinceLastCheckin} overdue={checkinOverdue} cycleSkipped={checkinCycleSkipped} />
        ) : null}
        </div>
        )}
      </main>

      {modalOpen ? (
        <TaskModal task={editing} prefill={addPrefill} contacts={contacts} properties={properties} units={units} propertyLabels={propertyLabels}
          saving={saving} onSave={saveTask}
          onClose={() => { setModalOpen(false); setEditing(null); setAddPrefill(null); }} />
      ) : null}

      {contactModalOpen ? (
        <ContactModal contact={editingContact} property={propFilter} prefillRole={contactCategory} propertyLabels={propertyLabels} saving={savingContact} onSave={saveContact}
          onClose={() => { setContactModalOpen(false); setEditingContact(null); }} />
      ) : null}

      {keyDateModalOpen ? (
        <KeyDateModal keyDate={editingKeyDate} properties={properties} propertyLabels={propertyLabels} saving={savingKeyDate} onSave={saveKeyDate}
          onClose={() => { setKeyDateModalOpen(false); setEditingKeyDate(null); }} />
      ) : null}

      {reportModalOpen ? (
        <ReportModal tasks={tasks} contacts={contacts} properties={properties} propertyLabels={propertyLabels} onClose={() => setReportModalOpen(false)} />
      ) : null}

      {propertiesModalOpen ? (
        <PropertiesManagerModal properties={properties} usedKeys={propertyKeysInUse} saving={savingProperty}
          onSave={updateProperty} onAdd={addProperty} onDelete={removeProperty}
          onClose={() => setPropertiesModalOpen(false)} />
      ) : null}

      {nameModalOpen ? (
        <DisplayNameModal currentName={currentUser} saving={savingName} onSave={saveDisplayName}
          onClose={() => setNameModalOpen(false)} />
      ) : null}
    </div>
  );
}
