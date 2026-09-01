# Bay Homes Ops Tracker

A shared task tracker for Bay Homes property operations. React + Vite frontend,
Supabase (Postgres + Auth) backend. Every team member logs in and sees the same
live list; changes sync in real time.

- Metrics: Total / Open / Waiting on Carrie / Stale / Done, plus per-property and
  per-category breakdowns that double as filters.
- Full task management: add, edit, inline status change, delete, search, filter.
- Auth-gated: only signed-in users can see or change anything.

---

## What you need

- **Node.js 18 or newer** (check with `node -v`).
- A free **Supabase** account — https://supabase.com
- A free host for the frontend — **Cloudflare Pages** is recommended (this guide
  uses it); Netlify works identically. A GitHub account makes deploys automatic.

---

## 1. Set up the database (Supabase)

1. Go to https://supabase.com, create a project, and wait for it to finish
   provisioning (~2 min). Save the database password somewhere safe.
2. In the dashboard, open **SQL Editor > New query**, paste the entire contents
   of `supabase/schema.sql`, and click **Run**. This creates the `tasks` table,
   security rules, and realtime.
3. Open **Project Settings > API** and copy two values:
   - **Project URL** → this is your `VITE_SUPABASE_URL`
   - **Project API keys > anon / public** → this is your `VITE_SUPABASE_ANON_KEY`

> The anon key is safe to expose in the browser. Your data is protected by Row
> Level Security (only signed-in users can read/write), not by hiding the key.

### Create logins for your team

For an internal tool, the simplest approach is to add users by hand:

- **Authentication > Users > Add user** → enter an email + password for each
  person (you, Mariam, Carrie, VAs). Tick "Auto Confirm User" so they can sign in
  immediately.

If you'd rather let people self-register from the login screen, go to
**Authentication > Providers > Email** and enable sign-ups. To skip inbox
confirmation, turn off "Confirm email" (fine for a small trusted team). Leave
sign-ups **disabled** if you want invite-only access.

---

## 2. Run it locally (optional, to test)

```bash
cp .env.example .env      # then edit .env and paste your two values
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173), sign in, and you're in.
On the very first load the app seeds your 37 starting tasks into the database.

---

## 3. Deploy to Cloudflare Pages

1. Put this project in a **GitHub repo** (create one, then):
   ```bash
   git init
   git add .
   git commit -m "Bay Homes Ops Tracker"
   git branch -M main
   git remote add origin https://github.com/YOUR-USER/bayhomes-tracker.git
   git push -u origin main
   ```
2. Go to the **Cloudflare dashboard > Workers & Pages > Create > Pages >
   Connect to Git**, and pick your repo.
3. Set the build settings:
   - **Framework preset:** Vite (or "None")
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Under **Environment variables**, add both:
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
5. Click **Save and Deploy**. In ~1 minute you get a live URL like
   `https://bayhomes-tracker.pages.dev`. Share it with your team — they sign in
   with the accounts you created.

Every future `git push` redeploys automatically. Client-side routing is handled
by `public/_redirects` (works on Cloudflare Pages and Netlify).

> **Netlify instead?** New site from Git → build command `npm run build`,
> publish directory `dist`, add the same two environment variables.

---

## Everyday use

- **Add task** (top right) or **edit** any row via the pencil.
- Change a task's **status** from its dropdown — the color and metrics update
  instantly and sync to everyone.
- Click any **KPI** or **property/category pill** to filter; click again to clear.
- **Export** downloads the whole list as CSV.

---

## Notes & limits

- **Free-tier pause:** a Supabase free project pauses after ~7 days with zero
  activity (data is kept; it just needs a manual resume in the dashboard). Daily
  use avoids this. Upgrading to Pro ($25/mo) removes it.
- **Permissions:** right now every signed-in user has full access (shared
  workspace). If you later want roles — e.g. a VA who can't delete — that's a
  change to the RLS policies in `supabase/schema.sql`.
- **Adding/removing people:** manage them under Supabase **Authentication >
  Users**. No redeploy needed.

## Project structure

```
index.html                 app shell + Montserrat font
supabase/schema.sql        run once in Supabase to set up the DB
.env.example               copy to .env with your keys
public/_redirects          SPA routing fallback for the host
src/
  main.jsx                 entry
  App.jsx                  config check → login → tracker
  Login.jsx                Supabase email/password auth
  Tracker.jsx              the app: metrics, list, add/edit/delete, realtime
  data.js                  properties, categories, statuses, seed data
  lib/supabase.js          Supabase client
  index.css                Tailwind + Montserrat base
```
