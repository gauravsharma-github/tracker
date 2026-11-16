# TrackIt web UI (study tracker & timer)

A web version of the **TrackIt – Study Tracker & Timer** Android app: projects/exams with a multi-level syllabus, a Pomodoro/stopwatch focus timer, a full-screen flip clock, spaced-repetition flashcards, notes, a day schedule, insights and a shareable progress card.

Data goes through one data-access layer (`js/api/api.js`) with two interchangeable backends:

- **This browser** (default): localStorage, with demo data on first start.
- **Your Google Sheet**: a small Apps Script web app (`backend/Code.gs`) stores everything in a spreadsheet you own. Each browser keeps an offline copy and syncs changes in the background, so your laptop and phone share the same data. Setup: [`backend/SETUP.md`](backend/SETUP.md).

Screens never know which backend is active, so a future server (e.g. AWS) is another backend behind the same functions.

## Run it

- **Easiest:** double-click `index.html`. It runs straight from disk (plain scripts, no build step).
- **Local server (recommended while developing):**
  ```bash
  cd trackit-web
  python3 -m http.server 5173     # or: npx serve -l 5173 .
  ```
  Then open http://localhost:5173.

The first start loads demo data (three projects, ~7 weeks of study sessions, flashcards, notes and schedule blocks). **Settings › Data** has *Reset demo data* and *Delete all data*.

## Put it on GitHub Pages

The app is static files with relative paths and hash URLs, so GitHub Pages serves it as is. No secrets are in the code (the Google Sheet URL and key are typed into Settings and stay in your browser), so a public repository is fine.

1. Create a repository on GitHub, for example `trackit` (public; Pages on private repositories needs a paid plan).
2. Upload the **contents** of this folder (so `index.html` is at the top level of the repo):
   ```bash
   cd trackit-web
   git init
   git add .
   git commit -m "TrackIt web"
   git branch -M main
   git remote add origin https://github.com/<your-user>/trackit.git
   git push -u origin main
   ```
   Or use **Add file › Upload files** on GitHub and drag everything in.
3. In the repository: **Settings › Pages › Build and deployment** → Source **Deploy from a branch**, Branch **main** and **/ (root)** → **Save**.
4. After a minute the site is live at `https://<your-user>.github.io/trackit/`.

To update later, commit and push again. GitHub Pages may serve the old files for a few minutes; a hard refresh (Ctrl/Cmd + Shift + R) picks up the new ones. On Android, Chrome's **⋮ › Add to Home screen** gives you an app icon (`manifest.webmanifest`).

The repository includes `.nojekyll` so GitHub serves every file untouched.

## Google Sheets backend

Full step-by-step instructions are in [`backend/SETUP.md`](backend/SETUP.md). In short:

1. New Google Sheet → **Extensions › Apps Script** → paste `backend/Code.gs` → run `setup` once.
2. **Deploy › New deployment › Web app** (Execute as **Me**, access **Anyone**) → copy the `/exec` URL.
3. In the sheet: **TrackIt › Connection details** shows the secret key.
4. In TrackIt: **Settings › Sync & backup › Connect**, paste URL + key, choose *Start fresh* or *Upload this browser's data*.
5. Other devices: **Settings › Connect another device** copies a connection code to paste on the phone.

How syncing works (`js/api/sheets-backend.js`):
- the app loads instantly from the browser's copy, then pulls the latest from the sheet (on start, when you come back to the tab, and on **Sync now**);
- every change is applied locally at once and queued; the queue is sent in batches a moment later, retried with backoff when offline, and replayed on top of fresh data;
- creates are idempotent on the server (an id that already exists is updated), so a retried request never duplicates rows;
- the sidebar (and a cloud icon on the phone dashboard) shows *Synced*, *Syncing…*, *N waiting* or *Offline*.

While connected to your own sheet, every Pro feature is unlocked.

`backend/dev/server.js` runs `Code.gs` locally in Node against an in-memory fake spreadsheet, so you can try and change the backend without deploying anything.

## Layouts

- **Below 1024px:** phone layout with a bottom tab bar (Home, Schedule, Timer, Cards, Insights), bottom sheets and a floating action button.
- **1024px and wider:** desktop dashboard with a left sidebar (project switcher, navigation with counts, subjects, a mini timer while one is running, Settings, Go Pro and a theme switch). Sheets become centred dialogs.
- **1280px and wider:** the dashboard adds a right-hand panel (today vs. goal, up next, flashcards due, recent notes).

Breakpoints live in `css/desktop.css` and `js/core/layout.js`.

## Features

- **Exams & projects:** switch between them from the pill at the top (or the sidebar). Each has subjects with their own colour.
- **Multi-level syllabus:** subject › unit › chapter › topic, any depth. Progress rolls up at every level (leaf topics done ÷ total). Tick a parent to complete everything under it. Each topic has due dates, notes, reorder, rename, delete and “study this now”. Add one topic or paste a whole indented outline.
- **Dashboard:** date strip with daily study time (click a day to see or log sessions), All/Due filter, completed %, time spent, KPI tiles (today vs. goal, streak, cards due), expandable subject cards with progress rings.
- **Focus timer:** Pomodoro (focus / short break / long break every N) or stopwatch, with the arc dial from the app. Time is saved as a session, linked to the topic you pick. Stop & save, skip, auto-start options, alarm sounds, ambient focus sounds (rain, white/brown noise, waves, ticking), browser notifications. The timer survives page reloads; the tab title shows the countdown.
- **Flip clock:** full screen, animated flip digits, timer or time-of-day mode, wallpapers and clock colours; controls hide when you stop moving the mouse.
- **Flashcards:** a deck per subject with spaced repetition (SM-2 style Again/Hard/Good/Easy, keys 1–4). Shows due today / revised today, “study all due” across subjects, edit/reset/delete cards, export, and **bulk import** of cards made by ChatGPT / Gemini (`question :: answer`, tabs, Q:/A:, CSV or JSON).
- **Notes:** masonry grid tinted with the subject colour (as in the app), pin, search, filter by subject, link a note to a topic, clickable links.
- **Schedule (day view):** plan study blocks on a timeline (click a slot to add), repeat once/daily/weekdays/weekly, mark done, start the timer from a block, “now” line, planned vs. studied time, block reminders.
- **Insights:** week / month / 3-month ranges, this project or all; time per day stacked by subject, subject split, hours of the day, syllabus completion over time, consistency heatmap, session timeline, streaks.
- **Templates (“Add Exam/Project”):** search and category tiles (Exam, Programming, Medical), 25 preloaded syllabi with previews, **AI generator** (copy a prompt, paste the outline back), import a template shared by a friend, or start blank. Projects can be shared as a template code or exported as an outline.
- **Share progress:** card with progress, Spent Today / Spent Total / Parts Done and a daily bar chart; light/dark theme and colours; download, copy or share it as a PNG.
- **Settings:** connect your Google Sheet (sync status, sync now, open the sheet, connect another device), theme (dark/light/system), 12/24-hour, week start, timer lengths, alarm and volume, daily goal, daily reminder with a subtle sound, ambient sound, wallpapers, export/import a JSON backup, export sessions as CSV.
- **TrackIt Pro:** upgrade screen with plans; the free plan limits projects/subjects and locks some sounds, wallpapers and share colours (limits and placeholder prices in `js/config.js`).
- **Keyboard (desktop):** `Space` start/pause, `S` stop & save, `F` flip clock, `N` new subject, `G` then `D/T/S/C/I/N/P` to jump to a page, `1–4` grade a card, `Esc` close.

## Project structure

```
index.html                 App shell; loads the CSS and the scripts in order
css/
  fonts.css                Self-hosted Inter + Material Symbols Rounded (icons, FILL axis)
  tokens.css               Colours, radii, dark & light theme variables
  base.css                 Reset, phone frame, top bar, bottom tabs, buttons, inputs
  components.css           Rings, bars, chips, date strip, subject cards, tree, timer, overlays, charts…
  screens.css              Per-screen layout (phone first), flip clock
  desktop.css              Sidebar + desktop/wide grids, centred dialogs
js/
  config.js                App name, palette, categories, timer defaults, sounds, limits, Pro plans
  main.js                  Boot, routing → screens, rendering, click/input delegation, shortcuts
  api/
    api.js                 ⇦ DATA-ACCESS LAYER: picks a backend, connect / disconnect, sync status
    ops.js                 Write operations (create / update / remove / settings) shared by all backends
    local-backend.js       Backend 1: localStorage (demo / browser only)
    sheets-backend.js      Backend 2: Google Sheet via Apps Script (cache, offline queue, batched sync)
    storage.js             localStorage with in-memory fallback
    seed.js                Demo data
    templates-data.js      Template library (indented outlines)
  core/
    store.js               State, selectors, actions (optimistic updates → api)
    stats.js               Progress roll-up, time per node/subject/day, streaks, due items
    srs.js                 Spaced-repetition scheduling
    outline.js             Parser for pasted outlines / AI output and flashcard lists
    timer.js               Pomodoro / stopwatch engine (persists across reloads)
    sound.js               Alarm, reminder and ambient sounds (Web Audio, no files)
    router.js, theme.js, layout.js, reminders.js, util.js
  components/              overlays (sheets, dialogs, menus, toasts), ui helpers, charts, forms,
                           syllabus tree, timer card, wallpapers, sync (Google Sheet UI), sidebar / bottom tabs
  screens/                 dashboard, subject, focus, flipclock, flashcards, study, notes, schedule,
                           insights, templates, share, projects, settings, pro
backend/
  Code.gs                  Google Apps Script web app (paste into your sheet)
  SETUP.md                 Step-by-step setup for the Google Sheet backend
  dev/                     Fake Apps Script for local testing (node backend/dev/server.js)
manifest.webmanifest       Home-screen icon / name
.nojekyll                  Tells GitHub Pages to serve files as they are
```

Each screen is `{ render(ctx) → html, mount?(root) → cleanup, actions: { [data-act]: handler }, inputs?, changes?, keys? }`. Any element with `data-act="name"` calls the current screen's handler (or a shared one in `main.js` / `tree.js`). Text inputs use `data-input`, selects/toggles use `data-change`.

Files are plain scripts that attach to a global `TI` namespace, so the app works from `file://`. If you later move to a bundler (Vite etc.), each file maps cleanly to an ES module.

## Writing another backend (e.g. AWS later)

The UI never touches storage directly. Actions in `js/core/store.js` update state immediately and then call `TI.api`, which turns every write into an operation object (`js/api/ops.js`) and hands it to the active backend. A backend only needs `loadAll()`, `write(op)`, `snapshot()` and `replaceAll(data)` – the Sheets backend is a working example with caching and an offline queue that you can copy. If you prefer classic REST endpoints, this is how the functions map:

| `api` function | Suggested endpoint |
| --- | --- |
| `loadAll()` | `GET /me/bootstrap` (projects, subjects, nodes, sessions, cards, reviews, notes, blocks, settings, account) |
| `create(coll, item)` | `POST /{collection}` |
| `createMany(coll, items)` | `POST /{collection}/batch` |
| `update(coll, id, patch)` | `PATCH /{collection}/{id}` |
| `updateMany(coll, patches)` | `PATCH /{collection}/batch` |
| `remove(coll, ids)` | `DELETE /{collection}/{id}` or `POST /{collection}/delete` |
| `updateSettings(patch)` | `PATCH /me/settings` |
| `signIn(provider)` / `signOut()` | `POST /auth/{provider}` / `POST /auth/logout` |
| `backupNow()` | not needed once data lives on the server (keep as “sync now”) |
| `purchasePro(plan)` / `restorePurchase()` | `POST /billing/checkout` / `POST /billing/restore` |
| `listTemplates()` | `GET /templates?category=&q=` |
| `exportAll()` / `importAll(json)` | `GET /me/export` / `POST /me/import` |

Collections: `projects`, `subjects`, `nodes`, `sessions`, `cards`, `reviews`, `notes`, `blocks`.

### Data model

```
project  { id, name, category: exam|programming|medical|custom, color, templateId, order, archived, createdAt }
subject  { id, projectId, name, color, order, createdAt }
node     { id, subjectId, parentId|null, title, done, doneAt, due: 'YYYY-MM-DD'|null, order, createdAt }   // syllabus tree
session  { id, projectId, subjectId, nodeId|null, start (ms), duration (s), mode: pomodoro|stopwatch|manual, manual }
card     { id, subjectId, front, back, ease, interval (days), reps, lapses, due (ms), state: new|learning|review, lastReviewed, createdAt }
review   { id, cardId, subjectId, grade: again|hard|good|easy, at (ms) }
note     { id, subjectId, nodeId|null, title, body, pinned, createdAt, updatedAt }
block    { id, date, start 'HH:MM', end 'HH:MM', subjectId, nodeId|null, title, repeat: none|daily|weekdays|weekly, doneDates[], skipDates[], createdAt }
settings { theme, focusMin, shortMin, longMin, longEvery, autoBreaks, autoFocus, alarm, alarmVolume, ambient, ambientVolume,
           reminderOn, reminderTime, reminderSound, dailyGoalMin, wallpaper, clockColor, clockSeconds, h12, weekStart, activeProjectId }
account  { signedIn, provider, name, email, pro, plan, lastBackup }
```

`js/core/stats.js` and `js/core/srs.js` are pure functions, so the server can reuse them if you want it to compute progress or schedule reviews.

### A low-cost AWS setup that fits this shape

- **Hosting:** S3 + CloudFront for these static files.
- **Auth:** Cognito user pools (Google/Apple sign-in), JWT sent with each request.
- **API:** API Gateway HTTP API + Lambda (Node or Python) implementing the table above.
- **Data:** DynamoDB, single table keyed by `PK = USER#<id>`, `SK = <COLLECTION>#<id>`; `GET /me/bootstrap` becomes one query per user.
- **Reminders/push later:** EventBridge Scheduler + SNS / FCM for the native apps.

All of these have free tiers that comfortably cover personal or family use.

## What is mocked today

- Without a Google Sheet, data lives only in the browser. The Pro purchase pretends to succeed after a short delay (and isn't needed when you use your own sheet).
- Reminders and timer alarms fire only while the page is open (in-app toast + browser notification if allowed). Real push needs the backend.
- The AI template generator and bulk card import work by copying a prompt to ChatGPT/Gemini and pasting the answer back; there is no AI call inside the app.
- The real app ships 1000+ templates; this build includes 25 real syllabi in `js/api/templates-data.js`.

## Design notes

Colours, layout and type were matched against the app's Google Play screenshots, with colours sampled from the raw images: background `#080B12`, cards `#171B25`, inner chips `#252932`, primary blue `#405FFF`, subject colours such as `#C74FFA`, `#25AE97`, `#488AFF`, `#E0AD3C`, the Inter font and Material Symbols Rounded icons. The date strip, subject cards with rings and play buttons, nested syllabus with bars and ticks, arc timer, flip clock, flashcard deck, tinted notes, share card and template screen follow the screenshots. Screens that aren't shown publicly (schedule, insights, settings, Pro, projects, study session) are designed in the same visual language.

The app name, tagline, prices and limits live in `js/config.js`. **TrackIt is an existing product by vinztech.app**, so use your own name and logo (`assets/logo.svg`) before releasing this publicly.

## Credits

Inter (SIL Open Font License) and Material Symbols Rounded (Apache 2.0, subset to the icons used), bundled in `assets/fonts` with their licences.
