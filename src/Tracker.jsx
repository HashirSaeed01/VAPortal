import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Trash2, Pencil, X, Download, Search, AlertTriangle, CheckCircle2,
  Clock, Loader2, ClipboardList, UserCheck, ListChecks, ChevronDown, ChevronRight,
  RefreshCw, Users, LogOut,
} from "lucide-react";
import { supabase } from "./lib/supabase.js";
import {
  PROPERTIES, TYPES, STATUSES, STATES, STATE_META, STALE_DAYS,
  stateOf, daysSince, SEED,
} from "./data.js";

/* ---- DB row <-> app object mapping (DB uses snake_case start_date) ---- */
const toRow = (t) => ({
  title: t.title, property: t.property, type: t.type,
  start_date: t.startDate || "", status: t.status, notes: t.notes || "",
});
const fromRow = (r) => ({
  id: r.id, title: r.title, property: r.property, type: r.type,
  startDate: r.start_date || "", status: r.status, notes: r.notes || "",
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

/* ------------------------------- UI atoms ------------------------------- */

function Kpi({ label, value, sub, tone, icon: Icon, active, onClick }) {
  const tones = { slate: "text-slate-900", red: "text-red-600", amber: "text-amber-700", emerald: "text-emerald-600" };
  const clickable = typeof onClick === "function";
  return (
    <button type="button" onClick={onClick} disabled={!clickable}
      className={
        "text-left rounded-xl bg-white border p-4 transition " +
        (clickable ? "cursor-pointer hover:border-slate-400 " : "cursor-default ") +
        (active ? "border-slate-900 ring-1 ring-slate-900 " : "border-slate-200 ")
      }>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {Icon ? <Icon size={15} className="text-slate-400" /> : null}
      </div>
      <div className={"mt-2 text-4xl font-bold tabular-nums tracking-tight " + (tones[tone] || tones.slate)}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs font-medium text-slate-500">{sub}</div> : null}
    </button>
  );
}

function TaskModal({ task, onSave, onClose, saving }) {
  const [draft, setDraft] = useState(
    task || { title: "", property: PROPERTIES[0], type: TYPES[0], startDate: "", status: "To Start", notes: "" }
  );
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = draft.title.trim().length > 0;
  const field = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";
  const lbl = "block text-xs font-semibold text-slate-600 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ backgroundColor: "rgba(15,23,42,0.45)" }} onClick={onClose}>
      <div className="mt-10 w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">{task ? "Edit task" : "Add task"}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className={lbl}>Task</label>
            <textarea className={field} rows={2} value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="What needs doing?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Property</label>
              <select className={field} value={draft.property} onChange={(e) => set("property", e.target.value)}>
                {PROPERTIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Type</label>
              <select className={field} value={draft.type} onChange={(e) => set("type", e.target.value)}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select className={field} value={draft.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Start date</label>
              <input className={field} value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} placeholder="M/D/YYYY" />
            </div>
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea className={field} rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Context, updates, links…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="button" disabled={!valid || saving} onClick={() => onSave(draft)}
            className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
            {saving ? <Loader2 className="animate-spin" size={15} /> : null}
            {task ? "Save changes" : "Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Tracker ------------------------------- */

export default function Tracker({ session, onSignOut }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [stateFilter, setStateFilter] = useState("all"); // all | open | stale | <state>
  const [propFilter, setPropFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (error) { setError(error.message); return; }
    setError(null);
    setTasks((data || []).map(fromRow));
  }, []);

  // Initial load — seed the table on first run if it's empty.
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) { setError(error.message); setLoading(false); return; }
      if (!data || data.length === 0) {
        const { error: seedErr } = await supabase.from("tasks").insert(SEED.map(toRow));
        if (seedErr) setError(seedErr.message);
        await fetchTasks();
      } else {
        setTasks(data.map(fromRow));
      }
      setLoading(false);
    })();
  }, [fetchTasks]);

  // Live updates from teammates + refetch when returning to the tab.
  useEffect(() => {
    const channel = supabase
      .channel("tasks-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchTasks())
      .subscribe();
    const onFocus = () => fetchTasks();
    window.addEventListener("focus", onFocus);
    return () => { supabase.removeChannel(channel); window.removeEventListener("focus", onFocus); };
  }, [fetchTasks]);

  const refresh = async () => { setRefreshing(true); await fetchTasks(); setRefreshing(false); };

  const saveTask = async (task) => {
    setSaving(true);
    try {
      if (task.id) {
        const { error } = await supabase.from("tasks").update(toRow(task)).eq("id", task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert(toRow(task));
        if (error) throw error;
      }
      await fetchTasks();
      setModalOpen(false); setEditing(null);
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

  /* ----- metrics ----- */
  const metrics = useMemo(() => {
    const byState = Object.fromEntries(STATES.map((s) => [s, 0]));
    const byType = Object.fromEntries(TYPES.map((t) => [t, 0]));
    const byProp = Object.fromEntries(PROPERTIES.map((p) => [p, 0]));
    let stale = 0;
    for (const t of tasks) {
      const st = stateOf(t.status);
      byState[st]++; byType[t.type] = (byType[t.type] || 0) + 1; byProp[t.property] = (byProp[t.property] || 0) + 1;
      const age = daysSince(t.startDate);
      if (st !== "Done" && age !== null && age >= STALE_DAYS) stale++;
    }
    const done = byState["Done"];
    return {
      total: tasks.length, open: tasks.length - done, done,
      carrie: byState["Waiting on Carrie"], stale,
      propData: PROPERTIES.map((p) => ({ name: p, value: byProp[p] })).filter((d) => d.value).sort((a, b) => b.value - a.value),
      typeData: TYPES.map((t) => ({ name: t, value: byType[t] })).filter((d) => d.value).sort((a, b) => b.value - a.value),
    };
  }, [tasks]);

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
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (q && !(`${t.title} ${t.notes} ${t.property}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [tasks, stateFilter, propFilter, typeFilter, query]);

  const exportCsv = () => {
    const head = ["Task", "Property", "Type", "Start Date", "Status", "State", "Notes"];
    const rows = tasks.map((t) => [t.title, t.property, t.type, t.startDate, t.status, stateOf(t.status), t.notes]);
    downloadFile("bay-homes-tasks.csv", [head, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n"), "text/csv");
  };

  const anyFilter = stateFilter !== "all" || propFilter !== "all" || typeFilter !== "all" || query.trim() !== "";
  const clearFilters = () => { setStateFilter("all"); setPropFilter("all"); setTypeFilter("all"); setQuery(""); };
  const toggleState = (s) => setStateFilter((prev) => (prev === s ? "all" : s));

  const select = "rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";
  const pillCls = (active) =>
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition " +
    (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white font-bold">BH</div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Bay Homes Ops Tracker</h1>
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Users size={12} /> Shared workspace · everyone on the team sees the same live list
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs font-medium text-slate-500">{session?.user?.email}</span>
            <button type="button" onClick={refresh} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <Download size={15} /> Export
            </button>
            <button type="button" onClick={() => { setEditing(null); setModalOpen(true); }} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              <Plus size={16} /> Add task
            </button>
            <button type="button" onClick={onSignOut} title="Sign out" className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {error ? (
          <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-200">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><X size={16} /></button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={22} /></div>
        ) : (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Kpi label="Total tasks" value={metrics.total} icon={ClipboardList} sub="all items" active={!anyFilter} onClick={clearFilters} />
              <Kpi label="Open" value={metrics.open} tone="slate" icon={ListChecks} sub="not done" active={stateFilter === "open"} onClick={() => toggleState("open")} />
              <Kpi label="Waiting on Carrie" value={metrics.carrie} tone="amber" icon={UserCheck}
                   sub={`${metrics.total ? Math.round((metrics.carrie / metrics.total) * 100) : 0}% of all tasks`}
                   active={stateFilter === "Waiting on Carrie"} onClick={() => toggleState("Waiting on Carrie")} />
              <Kpi label={`Stale (${STALE_DAYS}+ days)`} value={metrics.stale} tone="red" icon={AlertTriangle} sub="open & aging"
                   active={stateFilter === "stale"} onClick={() => toggleState("stale")} />
              <Kpi label="Done" value={metrics.done} tone="emerald" icon={CheckCircle2} sub="complete / closed"
                   active={stateFilter === "Done"} onClick={() => toggleState("Done")} />
            </section>

            {/* Breakdowns (double as filters) */}
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-slate-800">Tasks by property</div>
                <div className="flex flex-wrap gap-2">
                  {metrics.propData.map((d) => (
                    <button key={d.name} type="button" onClick={() => setPropFilter((p) => (p === d.name ? "all" : d.name))} className={pillCls(propFilter === d.name)}>
                      {d.name}<span className="ml-1.5 tabular-nums font-bold opacity-60">{d.value}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-slate-800">Tasks by category</div>
                <div className="flex flex-wrap gap-2">
                  {metrics.typeData.map((d) => (
                    <button key={d.name} type="button" onClick={() => setTypeFilter((p) => (p === d.name ? "all" : d.name))} className={pillCls(typeFilter === d.name)}>
                      {d.name}<span className="ml-1.5 tabular-nums font-bold opacity-60">{d.value}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Filters */}
            <section className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks…"
                  className="w-56 rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm font-medium focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900" />
              </div>
              <select className={select} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                <option value="all">All states</option>
                <option value="open">Open (not done)</option>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="stale">{`Stale (${STALE_DAYS}+ days)`}</option>
              </select>
              <select className={select} value={propFilter} onChange={(e) => setPropFilter(e.target.value)}>
                <option value="all">All properties</option>
                {PROPERTIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className={select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All categories</option>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {anyFilter ? <button type="button" onClick={clearFilters} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Clear</button> : null}
              <span className="ml-auto text-sm font-medium text-slate-500">{filtered.length} of {tasks.length}</span>
            </section>

            {/* Task list */}
            <section className="space-y-2">
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                  No tasks match these filters. <button type="button" onClick={clearFilters} className="font-semibold text-slate-700 underline">Show everything</button>
                </div>
              ) : (
                filtered.map((t) => {
                  const st = stateOf(t.status);
                  const meta = STATE_META[st];
                  const age = daysSince(t.startDate);
                  const isStale = st !== "Done" && age !== null && age >= STALE_DAYS;
                  const open = expanded === t.id;
                  return (
                    <div key={t.id} className="rounded-xl border border-slate-200 bg-white pl-4 pr-3 py-3" style={{ borderLeftColor: meta.color, borderLeftWidth: 4 }}>
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={() => setExpanded(open ? null : t.id)} className="mt-0.5 shrink-0 text-slate-400 hover:text-slate-600" title={open ? "Collapse" : "Expand notes"}>
                          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold text-slate-900">{t.title}</span>
                            {isStale ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-600 ring-1 ring-inset ring-red-200">
                                <Clock size={11} /> {age}d
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{t.property}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{t.type}</span>
                            {t.startDate ? <span>· {t.startDate}</span> : null}
                          </div>
                          {open && t.notes ? <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-2.5 text-xs font-medium leading-relaxed text-slate-600">{t.notes}</p> : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <select value={t.status} onChange={(e) => setStatus(t.id, e.target.value)}
                            className="rounded-md border-0 bg-transparent px-1 py-1 text-xs font-semibold hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-300"
                            title="Change status" style={{ color: meta.color, maxWidth: 150 }}>
                            {STATUSES.map((s) => <option key={s} value={s} style={{ color: "#0f172a" }}>{s}</option>)}
                          </select>
                          <button type="button" onClick={() => { setEditing(t); setModalOpen(true); }} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit"><Pencil size={15} /></button>
                          <button type="button" onClick={() => removeTask(t.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            <footer className="pt-2 pb-8 text-center text-xs font-medium text-slate-400">
              Live shared database · changes sync to everyone on the team in real time
            </footer>
          </>
        )}
      </main>

      {modalOpen ? (
        <TaskModal task={editing} saving={saving} onSave={saveTask} onClose={() => { setModalOpen(false); setEditing(null); }} />
      ) : null}
    </div>
  );
}
