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

**Already using the sheet? Update to the latest script (version 5 – v4 adds AI, v5 adds tidy `mcqs` / `quizzes` tabs for quiz questions; quizzes also work with v4, the data then sits in the `extra` column)** (v2 added attachments and the Dashboard's "last updated" order; v3 adds tidy columns for the five-stage ticks – the app also works with v2, the extra fields then sit in the `extra` column): open your sheet › **Extensions › Apps Script**, replace everything with the new `backend/Code.gs`, **Save**, run **setup** once, then **Deploy › Manage deployments › ✏️ › Version: New version › Deploy**. The URL and key stay the same. In TrackIt press **Settings › Sync now**. Details: [`backend/SETUP.md`](backend/SETUP.md#updating-the-script-later).

## AI: interview questions and mock interviews (Google Gemini, free tier)

AI runs **through your Google Sheet's script**: TrackIt sends the prompt to your script, the script adds your Gemini API key (kept in Script Properties, never in the browser or in connection codes) and calls Gemini. It needs the Google Sheet backend and script **version 4**.

**Set up (5 minutes):** get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → update `Code.gs` to version 4 and deploy a new version (see below) → reload the sheet, then **TrackIt › Set Gemini API key** and paste it (it runs a test) → in TrackIt, **Settings › AI** should say *AI ready*. Optional: **TrackIt › Choose AI model** (default `gemini-flash-latest`).

**1. Interview questions (stage 4 filled automatically).** When you tick a topic's Revision 2, TrackIt writes its interview questions in the background – with model answers, at your level, using the topic's PDF notes if it has any – and saves them as the topic's interview cards. You can also generate them any time: topic **⋮ › Generate interview questions (AI)**, or from the Interview test window. Review, untick what you don't want, save.

**2. Mock interviewer.** Topic **⋮ › Mock interview (AI)**, or **Mock interview with AI** in the Interview test window. Choose 3, 5 or 8 questions; the interviewer asks one at a time (drawing on the topic's interview cards), asks a follow-up when an answer is thin, and you answer by typing or with the microphone (Chrome / Edge). Optional: the interviewer reads questions aloud. Then you get a report: score out of 100, Pass / Shaky / Fail verdict, strengths, gaps, what to revise, and per-question feedback with an ideal answer. One click records the verdict on the topic's Interview test tick (you can pick a different result), the report is saved to the topic's notes, and weak questions can be added as cards.

**Settings › AI:** status, *About you* (helps pitch the level), question level (Moderate / Senior / Architect), questions per topic, automatic questions on/off, interviewer voice.

**When Gemini is busy.** The script tries your main model twice, then each backup model in turn (default: `gemini-flash-latest`, `gemini-flash-lite-latest`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`; change them in the sheet with **TrackIt › Set backup AI models**). Free limits are per model, so this also helps when one model's limit is used up. If every model fails, automatic questions are queued and retried every few minutes, and everywhere you get **Do it in Claude instead**: TrackIt copies a ready-made prompt, you paste it into your Claude chat (attach the topic's PDFs if you like), then paste Claude's reply back – questions are saved as cards, and a mock-interview report records Pass / Shaky / Fail just like the built-in one. The Interview test window always has these Claude links too.

**Limits and privacy:** Gemini's free tier has per-minute and per-day limits; if you hit one, TrackIt says so – wait a minute or until the next day. On the free tier Google may use prompts to improve its products, so don't send confidential client material.

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
- **Five stages per topic:** every topic has five ticks in a row – Learn → Revision 1 (next day) → Revision 2 (7 days later) → Interview test (7 days later) → Re-practice (7 days later). Hover a tick to see its name and date. Each tick is 20% of the topic; a topic counts as *mastered* only after all five. The next tick gets an amber ring when it's due today and a red ring when overdue; due stages count in "topics due" and the Due filter. Ticking a stage before its date asks you first. The interview test runs the topic's own flashcards (link cards to a topic in the card editor, or **⋮ › Interview cards**) and records **Pass** (Re-practice in 7 days), **Shaky** (test again in 3 days) or **Fail** (back to Revision 2). Click the last filled tick, or **⋮ › Undo last stage**, to undo; **⋮ › Stage history** lists every tick with its date. A unit's tick marks *Learn* done for all its not-started topics. Topics ticked before this feature became *Learn done* on the day you ticked them, with their Revision 1s spread at most 5 a day.
- **Quizzes gate the first three stages:** ticking Learn, Revision 1 or Revision 2 opens a quiz of the topic's own multiple-choice questions (5, 10 or 15 per quiz – set per project in its edit form; 10 by default). Score **80% or more** and the tick turns green; below that it turns **red** with your score, you see a review of every answer (with your explanations), and you can retry after 2 hours. Questions you got wrong come back first, and each revision prefers questions you haven't just seen. A topic needs at least 5 questions; with fewer you can add some or *tick without a quiz* (the stage history shows it). Add questions with no AI: topic **⋮ › Quiz questions** (one by one, or **Paste many** in a simple `Q: / A) … * / Why:` format), or for a whole subject or project use **⋮ › Quiz questions spreadsheet (CSV)** – download the template with your topics filled in, complete it in Excel or Google Sheets, import it. Questions travel with shared templates and project JSON. Already-ticked Learn stages stay green.
- **Sources:** each project keeps a list of what you study from – courses, videos, docs, books – in the project view's side panel, below the heatmap and the focus card (on phones, under the heatmap). Click a name to open it in a new tab. **Add** takes a link (the name is suggested from it; paste several links separated by spaces to add them all), an optional note, and recognises sites like Udemy, YouTube, Trailhead, Coursera, GitHub, Google Drive and PDFs for the icon. Each source's ⋮ menu: open, copy link, edit, move up/down, delete. Sources travel with the project's shared JSON.
- **Re-organise the syllabus:** subject **⋮ › Move into another subject…** turns a subject into a unit inside another subject (or inside a new one); topic/unit **⋮ › Move to…** moves it anywhere – another unit, another subject, another project – or **Make it a subject**. You pick the exact position ("After Number System"), see what moves with it (topics, notes, cards, files, study time), and can **Undo** from the message right after. Shortcuts in the topic menu: *Make it a subject*, *Move up a level*, *Move into “unit above”*. Stages, quiz questions and attempts, interview cards and reviews, notes, PDFs/audio, schedule blocks and study time all follow; a subject's own notes, files and time attach to its new unit. A single topic made into a subject keeps everything as that subject's one topic.
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
node     { id, subjectId, parentId|null, title, stage: 0–5, stageDue: 'YYYY-MM-DD'|null, done (= mastered), doneAt, due: 'YYYY-MM-DD'|null, order, createdAt }   // syllabus tree
source   { id, projectId, name, url, note, order, createdAt, updatedAt }   // study sources (links)
mcq      { id, nodeId, subjectId, q, options: [2–6], correct: index, why, createdAt, updatedAt }   // quiz questions
quiz     { id, nodeId, subjectId, projectId, stage: 1–3, score, total, passed, at, answers: [{ id, pick, ok }] }   // quiz attempts
stage    { id, nodeId, subjectId, projectId, stage: 1–5, result: ''|pass|shaky|fail, at, early, toStage, prevStage, prevDue, prevDone, prevDoneAt }   // one per tick (history, undo, heatmap)
session  { id, projectId, subjectId, nodeId|null, start (ms), duration (s), mode: pomodoro|stopwatch|manual, manual }
card     { id, subjectId, nodeId|null (topic, for its interview test), front, back, ease, interval (days), reps, lapses, due (ms), state: new|learning|review, lastReviewed, createdAt }
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
