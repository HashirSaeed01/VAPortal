import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase, isConfigured } from "./lib/supabase.js";
import Login from "./Login.jsx";
import Tracker from "./Tracker.jsx";

function ConfigNeeded() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-lg font-bold">Almost there</h1>
        <p className="mt-2 text-sm text-slate-400">
          This app needs your Supabase keys. Create a <code className="rounded bg-slate-800 px-1">.env</code> file
          (locally) or set environment variables (when deployed) with:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100 border border-slate-800">
{`VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>
        <p className="mt-3 text-sm text-slate-400">
          Find both under <span className="font-semibold text-slate-200">Supabase → Project Settings → API</span>. See the README for
          full setup and deploy steps.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isConfigured) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));

    // The background refresh timer can miss its window on a tab that's
    // sat inactive for hours (laptop asleep, phone browser backgrounded),
    // leaving a JWT that's already expired by the time you come back.
    // Forcing a refresh check the moment the tab is visible again catches
    // that before any request has a chance to fail with "JWT expired".
    const onVisibility = () => {
      if (document.visibilityState === "visible") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!isConfigured) return <ConfigNeeded />;

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-600">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  if (!session) return <Login />;

  return <Tracker session={session} onSignOut={() => supabase.auth.signOut()} />;
}
