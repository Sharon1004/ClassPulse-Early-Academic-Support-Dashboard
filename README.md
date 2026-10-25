# ClassPulse

**Every learner, noticed early.** ClassPulse is an explainable early-warning dashboard for teachers. It brings attendance and assessment trends together, flags students who may need support, and shows *exactly why*, so the teacher always decides what happens next.

Built for **Innovators Conclave 2026** (IC26-02-02, Software Challenge) by B. Sharon Preethi, P. Poojadevi and T. Priyanjali.

> All demo data is **synthetic** (invented names). Do not upload real student data unless you have the right consent and a secured deployment.

## What it does

| Area | What it does |
|---|---|
| **Dashboard** | KPIs, "needs attention first" list with sparklines, a class risk split, a **pulse grid** (every student × every week, coloured against your attendance threshold) and trend charts. |
| **Explainable alerts** | 4 transparent rules: low attendance, attendance drop, low scores, score decline. Each alert shows the rule, the observed value and the threshold. No hidden score. |
| **Threshold simulator** | Drag a slider in Settings and see how many students would change level *before* saving. Admins save; teachers can explore. |
| **PulsePath plans** | Create support plans prefilled from a student's alerts, tick off actions, log follow-ups, complete or cancel. |
| **Support impact** | Compares attendance and scores before vs after each plan started. Says "awaiting data" honestly until new weeks arrive. |
| **Assignments & tests** | Teachers publish work, review submissions, grade, and decide when marks are released. Students get their own portal. |
| **CSV import** | Strict validation with line-numbered errors, drag-and-drop, merge or replace. |
| **Roles** | **Admin**: everything. **Teacher**: students, plans, assessments, read-only settings. **Student**: own work and marks only. |
| **Quality of life** | Command palette (**Ctrl/⌘ + K**), light and dark themes, shareable URLs (`#/students/…`), keyboard and screen-reader friendly, responsive down to phones. |

## Run it locally

You need **Node.js 20 LTS** (18.11+ works). From the project folder:

```bash
npm run setup                 # installs root, server and client dependencies
cp .env.example server/.env   # Windows: copy .env.example server\.env
npm run dev                   # API on :5000, app on http://localhost:5173
```

For a local demo you can leave `.env` empty. **Demo logins:** `admin@classpulse.demo`, `teacher@classpulse.demo`, `student@classpulse.demo`. The password is your `DEMO_PASSWORD`, or **`ClassPulse@2026`** if you left it empty (local only). Demo data (36 students, 12 weeks, 6 support plans) is created on first start, and admins can restore it from **Settings & data**.

```bash
npm test      # 24 API integration checks (auth, roles, alerts, plans, impact, CSV, simulator)
npm run build # production build of the React app into client/dist
npm start     # serve API + built app together on one port (set NODE_ENV=production first)
```

## Deploy for free (Render + MongoDB Atlas)

The Express server serves both the API and the built React app, so **one free web service** is all you need.

### 1. Free database (recommended, 5 minutes)
Render's free disk is erased on every restart and sleep, so use Atlas to keep data.
1. Create a free **M0** cluster at <https://www.mongodb.com/atlas>.
2. **Database Access**: add a user with a strong password.
3. **Network Access**: allow `0.0.0.0/0` (Render's free IPs change; the strong password is your protection).
4. **Connect → Drivers**: copy the `mongodb+srv://…` string and replace `<password>` (URL-encode special characters, e.g. `@` → `%40`).

Skipping this still works: the app runs on a local file and re-creates the demo data after each restart, which is fine for a quick demo but loses anything you add.

### 2. Put the code on GitHub
```bash
git init && git add . && git commit -m "ClassPulse"
# create an empty GitHub repo, then:
git remote add origin https://github.com/<you>/classpulse.git && git push -u origin main
```
`.env`, `node_modules` and `server/data` are already git-ignored.

### 3. Deploy on Render
1. Go to <https://render.com> → **New → Blueprint** and pick your repo. Render reads `render.yaml`.
2. When prompted, enter **`DEMO_PASSWORD`** (a strong password for the demo logins) and, if you made one, **`MONGODB_URI`**. `JWT_SECRET` is generated for you.
3. Click **Apply**. After the build, open the `onrender.com` URL and sign in.

*Prefer clicking through manually?* **New → Web Service**, build command `npm run render-build`, start command `npm start`, plan **Free**, and set `NODE_ENV=production`, `JWT_SECRET` (32+ random characters), `DEMO_PASSWORD`, and optionally `MONGODB_URI`.

**Free-tier behaviour:** the service sleeps after ~15 minutes idle, so the first request can take up to a minute. Before a demo, open the URL once to wake it, or ping `/api/health` every 10 minutes with a free monitor such as UptimeRobot.

### Other free hosts
The included `Dockerfile` runs on Fly.io, Koyeb, Railway or Hugging Face Spaces (Docker). Set the same environment variables; the server listens on `PORT`.

## How alerts work (explain this to judges)

- **Low attendance**: average of the last 4 weeks is below the minimum.
- **Attendance drop**: last 3 weeks vs the 3 before fell by at least the drop threshold.
- **Low scores**: average of the last 2 assessments is below the minimum.
- **Score decline**: last 2 assessments vs the 2 before fell by at least the drop threshold.
- An alert is *high* if it is 10+ points beyond the threshold (or a drop of 2× the threshold). Risk points: 20 per medium alert, 35 per high alert (max 100). Risk level is High with any high alert or 3+ alerts, Medium with 1–2.
- Rule-based, not a black box. It supports teacher judgement and never replaces it.

## CSV format

```
name,class,week,attendance_pct,score_pct
Asha Example,9-A,1,96,80
Asha Example,9-A,2,94,
```
One row per student per week; `score_pct` may be empty; students are matched by name + class. Try `sample-data/sample_import.csv`. Nothing is imported until the whole file is valid.

## Project layout

```
package.json         root scripts: setup, dev, build, start, test, render-build
render.yaml          Render blueprint (free web service)
Dockerfile           container build for any Docker host
.github/workflows/   CI: tests + production build
.env.example         template for server/.env (placeholders only)
sample-data/         sample CSV
server/              Express API: index.js, store.js (MongoDB or JSON file), alerts.js, csv.js, seed.js, test.js
client/              React + Vite app
  src/App.jsx        shell, hash router, theme, command palette
  src/styles.css     design system (tokens, light/dark, components)
  src/components/    Dashboard, Students, StudentProfile, PulsePath, Impact,
                     Assessments, StudentDashboard, Settings, Login, ui, icons
```

## Security notes and known limitations

- In production the server refuses to start without `JWT_SECRET` (16+ chars) and `DEMO_PASSWORD`. Login is rate-limited and sessions expire after 8 hours.
- Demo accounts share one password. A real deployment needs per-user accounts and password reset.
- Login rate-limiting is in memory (resets on restart). Teachers can see all students (no per-class assignment yet).
- Impact figures show association, not proof of cause.
- The MongoDB path and live hosting depend on your own Atlas cluster and Render account, so they were not exercised here. Local file storage, the API, and the production build were tested.
