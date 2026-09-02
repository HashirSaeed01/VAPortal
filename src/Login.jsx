import React, { useState } from "react";
import { Loader2, Building2 } from "lucide-react";
import { supabase } from "./lib/supabase.js";

export default function Login() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) setError(error.message);
        else setMessage("Account created. If email confirmation is enabled, check your inbox, then sign in.");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-900 font-bold">BH</div>
          <div className="text-xl font-bold tracking-tight">Bay Homes Ops Tracker</div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h1 className="text-base font-semibold">{mode === "signin" ? "Sign in" : "Create an account"}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {mode === "signin"
              ? "Use the email and password set up for your team."
              : "New accounts can be created here if sign-ups are enabled."}
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Email</label>
              <input type="email" required autoComplete="email" className={field} value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@bayhomes.co" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Password</label>
              <input type="password" required autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className={field} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>

          {error ? <div className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-500/30">{error}</div> : null}
          {message ? <div className="mt-3 rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/30">{message}</div> : null}

          <button type="submit" disabled={busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-50">
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <div className="mt-4 text-center text-xs text-slate-500">
            {mode === "signin" ? (
              <button type="button" className="font-semibold text-slate-300 hover:underline" onClick={() => { setMode("signup"); setError(null); setMessage(null); }}>
                Need an account? Create one
              </button>
            ) : (
              <button type="button" className="font-semibold text-slate-300 hover:underline" onClick={() => { setMode("signin"); setError(null); setMessage(null); }}>
                Already have an account? Sign in
              </button>
            )}
          </div>
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-600">
          <Building2 size={12} /> Shared team workspace for Bay Homes property operations
        </p>
      </div>
    </div>
  );
}
