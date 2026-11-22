# TrackIt web UI (study tracker & timer)

A web version of the **TrackIt – Study Tracker & Timer** Android app: projects/exams with a multi-level syllabus, a Pomodoro/stopwatch focus timer, a full-screen flip clock, spaced-repetition flashcards, notes, a day schedule, insights and a shareable progress card.

Data goes through one data-access layer (`js/api/api.js`) with two interchangeable backends:

- **This browser** (default): localStorage, with demo data on first start.
- **Your Google Sheet**: a small Apps Script web app (`backend/Code.gs`) stores everything in a spreadsheet you own. Each browser keeps an offline copy and syncs changes in the background, so your laptop and phone share the same data. Setup: [`backend/SETUP.md`](backend/SETUP.md).

Screens never know which backend is active, so a future server (e.g. AWS) is another backend behind the same functions.

**Attachments** (PDF notes and audio recordings on any subject, unit or topic) are stored as files in **your own private GitHub repository**, through GitHub's API. Only the file details (name, path, size…) go into the data above. See [Attachments](#attachments-pdf-notes-and-audio).

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

**Already using the sheet? Update to version 2** (needed for attachments and the "last updated" order on the Dashboard): open your sheet › **Extensions › Apps Script**, replace everything with the new `backend/Code.gs`, **Save**, run **setup** once, then **Deploy › Manage deployments › ✏️ › Version: New version › Deploy**. The URL and key stay the same. In TrackIt press **Settings › Sync now**. Details: [`backend/SETUP.md`](backend/SETUP.md#updating-the-script-later).

## Attachments (PDF notes and audio)

Attach **several PDFs** (up to 25 MB each) and **several recordings** (up to about an hour: M4A from your phone or Mac Voice Memos, AAC from Evernote, MP3, WAV…) to any subject, unit or topic.

**One-time setup (about 5 minutes, free):**
1. On GitHub create a **private** repository, e.g. `trackit-files`, and tick *Add a README*.
2. Create a **fine-grained personal access token** (GitHub › Settings › Developer settings › Personal access tokens › Fine-grained tokens › *Generate new token*):
   - *Repository access:* **Only select repositories** → `trackit-files`
   - *Permissions › Repository permissions › Contents:* **Read and write** (Metadata: read-only is added automatically)
   - *Expiration:* your choice (up to a year, or none). When it expires, uploads say the token was rejected; make a new one and paste it in Settings.
3. In TrackIt: **Settings › Attachments (GitHub) › Set up**, enter your username, the repository name (or paste its URL) and the token, **Check repository**, **Save**. TrackIt refuses public repositories.
4. Other devices: with the Google Sheet backend, **Connect another device** codes now carry these GitHub settings too. Otherwise repeat step 3 on each device (same token is fine).

**Using it:**
- Topic **⋮ menu › Attach PDF / audio** (subjects: the subject's ⋮ menu). Pick several files at once, or drop them on the **Attachments** window. Files are named for you, e.g. `SSC-CGL/Quantitative-Aptitude/Number-System/Divisibility-rules/Divisibility-rules-notes-1.pdf` and `…-audio-1.m4a`.
- Small icons appear next to the name: 📒 notes, PDF, 🎧 audio (with a count when there are several). Click one to open it **in a new tab**: PDFs use the browser's PDF viewer; audio gets a player with ±10/30 s, speeds 0.75–2× and *continue where you left off*. Several files → a short menu to choose.
- **⋮ › Attachments (n)** lists them: open, rename (display name only), delete (also deletes the file from GitHub). Deleting a topic, subject or project deletes its files too.
- Notes work the same way: the notes icon opens the note in the **Edit note** window, or a list when the topic has several notes (plus *New note here*).

**Cost and limits:** private repositories are free on GitHub's free plan. GitHub accepts files up to 100 MB through this API and recommends keeping a repository under about 1 GB (5 GB at most); Settings shows how much you've used. As a guide, an hour of Voice Memos audio is roughly 30–60 MB and a scanned PDF of notes 2–20 MB, so 1 GB holds a lot; when it fills up, create a second repo and switch to it in Settings (older files keep pointing at the first repo). Opened files are cached by the browser, so replaying doesn't download them again.

**Privacy:** the token is stored only in your browser (and in connection codes you copy, so keep those private). Files go straight from your browser to GitHub; nothing else sees them.

## Layouts

- **Below 1024px:** phone layout with a bottom tab bar (Home = Dashboard, Schedule, Timer, Cards, Insights), bottom sheets and a floating action button.
- **1024px and wider:** desktop dashboard with a left sidebar (project switcher, navigation with counts, subjects, a mini timer while one is running, Settings, Go Pro and a theme switch). Sheets become centred dialogs.
- **1280px and wider:** the dashboard adds a right-hand panel (today vs. goal, up next, flashcards due, recent notes).

Breakpoints live in `css/desktop.css` and `js/core/layout.js`.

## Features

- **Exams & projects:** switch between them from the pill at the top (or the sidebar). Each has subjects with their own colour.
- **Multi-level syllabus:** subject › unit › chapter › topic, any depth. Progress rolls up at every level (leaf topics done ÷ total). Tick a parent to complete everything under it. Each topic has due dates, notes, reorder, rename, delete and “study this now”. Add one topic or paste a whole indented outline.
- **Dashboard (all projects):** every exam/project as a tile, **most recently updated first** (any edit counts: ticking a topic, a study session, a note, a card review, an attachment…). Each tile shows completion %, topics done, total and today's time, a 14-day chart, streak, subjects, cards/topics due and files. Sort by Recent, Progress or Name; totals for today, last 7 days, streak, topics done and due items on top. Click a tile to open it.
- **Progress heatmap:** on the Dashboard (all projects, a year at a glance) and at the top right of each project view. One square per day, coloured by activities that day: topics completed, study sessions, cards reviewed or created, notes written, files attached. Prev/Next pages through earlier weeks; hover a square for that day's breakdown.
- **Project view:** date strip with daily study time (click a day to see or log sessions), All/Due filter, completed %, time spent, KPI tiles (today vs. goal, streak, cards due), expandable subject cards with progress rings. Note/PDF/audio icons next to subject and topic names.
- **Focus timer:** Pomodoro (focus / short break / long break every N) or stopwatch, with the arc dial from the app. Time is saved as a session, linked to the topic you pick. Stop & save, skip, auto-start options, alarm sounds, ambient focus sounds (rain, white/brown noise, waves, ticking), browser notifications. The timer survives page reloads; the tab title shows the countdown.
- **Flip clock:** full screen, animated flip digits, timer or time-of-day mode, wallpapers and clock colours; controls hide when you stop moving the mouse.
- **Flashcards:** a deck per subject with spaced repetition (SM-2 style Again/Hard/Good/Easy, keys 1–4). Shows due today / revised today, “study all due” across subjects, edit/reset/delete cards, export, and **bulk import** of cards made by ChatGPT / Gemini (`question :: answer`, tabs, Q:/A:, CSV or JSON).
- **Notes:** masonry grid tinted with the subject colour (as in the app), pin, search, filter by subject and by topic, several notes per subject/unit/topic (each card shows where it belongs), clickable links.
- **Schedule (day view):** plan study blocks on a timeline (click a slot to add), repeat once/daily/weekdays/weekly, mark done, start the timer from a block, “now” line, planned vs. studied time, block reminders.
- **Insights:** week / month / 3-month ranges, this project or all; time per day stacked by subject, subject split, hours of the day, syllabus completion over time, consistency heatmap, session timeline, streaks.
- **Templates (“Add Exam/Project”):** search and category tiles (Exam, Programming, Medical), 25 preloaded syllabi with previews, **AI generator** (copy a prompt, paste the outline back), import a template shared by a friend, or start blank. Projects can be shared as a template code or exported as an outline.
- **Share (button on every project):** opens **Options** with two choices, as in the app:
  - **Share Progress:** card with progress, Spent Today / Spent Total / Parts Done and a daily bar chart; light/dark theme and colours; download, copy or share it as a PNG.
  - **Share Template:** preview the project's subjects (tap **+** to see their topics), then **Share Template as File** (`.json`), **Copy JSON code**, or **Get share link** (the whole template is packed into the link, so no server is needed). Optionally include your progress. The JSON uses the TrackIt app's format: `{ "title": "Project", "child": [ { "title": "Subject", "child": [ … ] } ] }`. Friends import it under **Templates › From a friend** (open the .json file or paste the code) or simply open the link.
- **Settings:** connect your Google Sheet (sync status, sync now, open the sheet, connect another device), connect your GitHub repo for attachments (usage, change token), theme (dark/light/system), 12/24-hour, week start, timer lengths, alarm and volume, daily goal, daily reminder with a subtle sound, ambient sound, wallpapers, export/import a JSON backup, export sessions as CSV.
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
    github.js              Attachment files in your private GitHub repo (upload, download, delete, naming)
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
                           syllabus tree, timer card, wallpapers, sync (Google Sheet UI),
                           attachments (icons, upload, manage, GitHub set-up),
                           template-share (JSON export, share links), sidebar / bottom tabs
  screens/                 overview (Dashboard: all projects), dashboard (project view), subject,
                           focus, flipclock, flashcards, study, notes, schedule, insights,
                           templates, share, share-template, import (share links),
                           viewer (PDF / audio tab), projects, settings, pro
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

Collections: `projects`, `subjects`, `nodes`, `sessions`, `cards`, `reviews`, `notes`, `blocks`, `attachments`.

### Data model

```
project  { id, name, category: exam|programming|medical|custom, color, templateId, order, archived, createdAt, updatedAt }   // updatedAt: last edit anywhere in it
subject  { id, projectId, name, color, order, createdAt }
node     { id, subjectId, parentId|null, title, done, doneAt, due: 'YYYY-MM-DD'|null, order, createdAt }   // syllabus tree
session  { id, projectId, subjectId, nodeId|null, start (ms), duration (s), mode: pomodoro|stopwatch|manual, manual }
card     { id, subjectId, front, back, ease, interval (days), reps, lapses, due (ms), state: new|learning|review, lastReviewed, createdAt }
review   { id, cardId, subjectId, grade: again|hard|good|easy, at (ms) }
note     { id, subjectId, nodeId|null, title, body, pinned, createdAt, updatedAt }
attachment { id, projectId, subjectId, nodeId|null, kind: pdf|audio, name, path, repo 'owner/name', branch, sha, size (bytes), mime, duration (s)|null, createdAt, updatedAt }   // the file itself is in GitHub
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

- Without a Google Sheet, data lives only in the browser (attachment files are still in your GitHub repo). The Pro purchase pretends to succeed after a short delay (and isn't needed when you use your own sheet).
- Reminders and timer alarms fire only while the page is open (in-app toast + browser notification if allowed). Real push needs the backend.
- The AI template generator and bulk card import work by copying a prompt to ChatGPT/Gemini and pasting the answer back; there is no AI call inside the app.
- The real app ships 1000+ templates; this build includes 25 real syllabi in `js/api/templates-data.js`.

## Design notes

Colours, layout and type were matched against the app's Google Play screenshots, with colours sampled from the raw images: background `#080B12`, cards `#171B25`, inner chips `#252932`, primary blue `#405FFF`, subject colours such as `#C74FFA`, `#25AE97`, `#488AFF`, `#E0AD3C`, the Inter font and Material Symbols Rounded icons. The date strip, subject cards with rings and play buttons, nested syllabus with bars and ticks, arc timer, flip clock, flashcard deck, tinted notes, share card and template screen follow the screenshots. Screens that aren't shown publicly (schedule, insights, settings, Pro, projects, study session) are designed in the same visual language.

The app name, tagline, prices and limits live in `js/config.js`. **TrackIt is an existing product by vinztech.app**, so use your own name and logo (`assets/logo.svg`) before releasing this publicly.

## Credits

Inter (SIL Open Font License) and Material Symbols Rounded (Apache 2.0, subset to the icons used), bundled in `assets/fonts` with their licences.
