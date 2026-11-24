# Google Sheets backend – setup (about 10 minutes)

TrackIt can store everything in **your own Google Sheet**, through a small Apps Script web app (`backend/Code.gs`). The app keeps a copy in each browser, so it opens instantly and works offline; changes sync to the sheet a moment later. Your phone and laptop stay in sync through the sheet.

You need: a Google account, and TrackIt open in a browser (your GitHub Pages URL, or `index.html` on your laptop).

## 1. Create the sheet

1. Go to [sheets.new](https://sheets.new) and name the spreadsheet, for example **TrackIt data**.
2. Open **Extensions › Apps Script**.
3. Delete the sample code, paste the **whole** `backend/Code.gs` file, and rename the project (top left) to **TrackIt backend**. Press **Ctrl/Cmd + S** to save.

## 2. Run `setup` once

1. In the toolbar's function list, choose **setup** and press **Run**.
2. Google asks for permission the first time:
   - **Review permissions** → choose your account.
   - You will see "Google hasn't verified this app". That is expected for your own script: click **Advanced › Go to TrackIt backend (unsafe)** → **Allow**.
   - The script only asks for access to *this* spreadsheet (`@OnlyCurrentDoc`).
3. The execution log shows `TrackIt is set up. Secret key: …`. The sheet now has tabs `projects`, `subjects`, `nodes`, `sessions`, `cards`, `reviews`, `notes`, `blocks` and `settings`.

## 3. Deploy it as a web app

1. Click **Deploy › New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set:
   - Description: `TrackIt v1`
   - **Execute as: Me**
   - **Who has access: Anyone**
4. Click **Deploy** (authorise again if asked) and **copy the Web app URL**. It ends in **`/exec`**.

"Anyone" means anyone who has the URL can reach the script, but every request must also carry your secret key, which exists only in the sheet's script properties and in your own browsers.

## 4. Connect TrackIt

1. Reload the spreadsheet. A **TrackIt** menu appears. **TrackIt › Connection details** shows your secret key (and the URL).
2. In TrackIt open **Settings › Sync & backup › Connect**.
3. Paste the **web app URL** and the **secret key**, then **Check connection**.
4. Choose:
   - **Start fresh** – recommended if the browser only has the demo data.
   - **Upload this browser's data** – if you already entered real data in this browser.
5. Click **Connect**. The sidebar shows "Synced just now".

## 5. Add your other devices

1. On the connected device: **Settings › Connect another device** copies a *connection code*.
2. On the phone or other browser: open TrackIt › **Settings › Connect › I have a connection code**, paste it, **Check connection** → **Use the data in my sheet** → **Connect**.
3. On Android Chrome you can then use **⋮ › Add to Home screen** to open TrackIt like an app.

Treat the connection code like a password. If you set up attachments (below) on the first device, the code also carries those GitHub settings, so the phone can open your PDFs and recordings right away.

## 7. AI with Google Gemini (optional, free)

1. Get a key: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) › **Create API key**.
2. Make sure your script is version 4 (see *Updating the script later*), including **Deploy › Manage deployments › ✏️ › New version**.
3. Reload the sheet. **TrackIt › Set Gemini API key**, paste the key, **OK**. Google asks you to allow the script to "connect to an external service" the first time – allow it. A test message should say *Working ✓*.
4. In TrackIt: **Settings › AI › Check** should say *AI ready*.

The key lives only in the script's properties. To remove it, run **Set Gemini API key** again with an empty box. To use another model: **TrackIt › Choose AI model**.

## 6. Attachments: PDFs and audio in a private GitHub repo (optional)

The sheet stores the file details (name, path, size); the files themselves go into a GitHub repository you own. Private repositories are free.

1. On GitHub: **+ › New repository**, name it e.g. `trackit-files`, choose **Private**, tick **Add a README file**, **Create repository**.
2. Make a token: your photo › **Settings › Developer settings › Personal access tokens › Fine-grained tokens › Generate new token**.
   - **Token name:** TrackIt files · **Expiration:** your choice
   - **Repository access:** *Only select repositories* → `trackit-files`
   - **Permissions › Repository permissions › Contents:** *Read and write*
   - **Generate token** and copy it (it starts with `github_pat_`; GitHub shows it only once).
3. In TrackIt: **Settings › Attachments (GitHub) › Set up** → your GitHub username, `trackit-files` (or the repo URL), the token → **Check repository** → **Save**.
4. Copy a fresh connection code (**Settings › Connect another device**) for your other devices, or repeat step 3 on them.

When the token expires, uploads and downloads say *GitHub rejected the token*: generate a new one the same way and paste it under **Settings › Attachments › Change token or repository** on each device (or send a new connection code).

## Updating the script later

Edit `Code.gs`, save, then **Deploy › Manage deployments → ✏️ (edit) → Version: New version → Deploy**. Editing the existing deployment keeps the same `/exec` URL, so your devices stay connected. (A brand-new deployment would give a new URL.)

**Updating to version 4** (adds the AI proxy used by interview questions and mock interviews, plus a TrackIt › Set Gemini API key menu): same four steps as below, then section 7. Version 4 includes everything in version 3.

**Updating to version 3** (adds the `stages` tab and `stage` / `stageDue` / card `nodeId` columns for the five-stage ticks): same four steps as below. Optional – with version 2 the new fields are kept in each tab's `extra` column.

**Updating from version 1 to version 2** (adds the `attachments` tab and the projects' `updatedAt` column used by the Dashboard's "last updated" order):

1. In the sheet: **Extensions › Apps Script**, select all the code in `Code.gs` and replace it with the new `backend/Code.gs`. **Save**.
2. Choose the **setup** function and **Run** it once. It adds the new tab and column and keeps your data and secret key.
3. **Deploy › Manage deployments → ✏️ → Version: New version → Deploy**.
4. In TrackIt: **Settings › Sync now** on each device. Until then TrackIt keeps working, but attaching files asks you to update first.

## Looking at your data

Each tab is a plain table with one row per item. Please **don't rename or delete the header row** – the script finds columns by their names. You can:

- add your own columns to the right (the script leaves them alone), or better,
- build reports on a separate tab, for example `=QUERY(sessions!A:H, "select C, sum(F)/3600 group by C label sum(F)/3600 'hours'")`.

Times are stored as milliseconds since 1970 (UTC). `=EPOCHTODATE(E2, 2)` turns one into a readable date-time (in UTC).

## Troubleshooting

| Message in TrackIt | What to do |
| --- | --- |
| *Could not reach the script* | Use the URL ending in `/exec` (not `/dev`), make sure **Who has access** is **Anyone**, and that you are online. |
| *That URL did not return TrackIt data* | The URL is not the web app URL, or access isn't "Anyone". Copy it again from **Deploy › Manage deployments**. |
| *Wrong secret key* | Copy it again from **TrackIt › Connection details**. If you created a new key, reconnect every device. |
| *The sheet is not set up yet* | Run `setup` once in the Apps Script editor. |
| *The sheet is busy* | Two devices synced at the same moment; it retries automatically. |
| Sidebar says "N waiting" | Changes are safe in the browser and will sync when the script is reachable. Use **Settings › Sync now** to retry. |
| *Update your Google Sheet script* (when attaching) | Follow **Updating from version 1 to version 2** above. |
| *Your sheet script is too old for AI* | Update to version 4 and deploy a new version. |
| *AI is not set up yet* | TrackIt › Set Gemini API key in the sheet (section 7). |
| *The free Gemini limit is used up* | Wait a minute (per-minute limit) or until the next day (daily limit). |
| *GitHub rejected the token* | The token is wrong or expired. Make a new one (step 6) and paste it in **Settings › Attachments**. |
| *Repository not found* | Check the username and repository name, and that the token was given access to that repository. |
| *The token is not allowed to do this* | Edit the token on GitHub: **Contents › Read and write** for that repository. |

## Security and limits

- Your key lives in the script's properties and in the browsers you connect – never in the code on GitHub.
- To lock out every device (for example after losing a phone): **TrackIt › Create a new secret key**, then reconnect your own devices.
- Apps Script's free quotas are far above one person's use. TrackIt sends changes in batches, usually one small request per few seconds of activity.
- Two devices editing the very same item offline: the last change synced wins.
- Attachments: GitHub takes files up to 100 MB through its API (TrackIt allows PDFs up to 25 MB and audio up to 95 MB) and recommends keeping a repository under about 1 GB. The GitHub token lives only in your browsers and connection codes, never in the sheet.

## Try it without Google (optional, for development)

`backend/dev/` contains a small fake Apps Script that runs `Code.gs` in Node with an in-memory "spreadsheet":

```bash
node backend/dev/server.js          # prints a secret key, listens on http://localhost:8787
```

In TrackIt (served from `http://localhost`), connect with the URL `http://localhost:8787/macros/s/TEST/exec` and the printed key. `http://localhost:8787/__dump` shows what the "sheet" contains.
