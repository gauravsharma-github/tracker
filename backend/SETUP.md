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

Treat the connection code like a password.

## Updating the script later

Edit `Code.gs`, save, then **Deploy › Manage deployments → ✏️ (edit) → Version: New version → Deploy**. Editing the existing deployment keeps the same `/exec` URL, so your devices stay connected. (A brand-new deployment would give a new URL.)

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

## Security and limits

- Your key lives in the script's properties and in the browsers you connect – never in the code on GitHub.
- To lock out every device (for example after losing a phone): **TrackIt › Create a new secret key**, then reconnect your own devices.
- Apps Script's free quotas are far above one person's use. TrackIt sends changes in batches, usually one small request per few seconds of activity.
- Two devices editing the very same item offline: the last change synced wins.

## Try it without Google (optional, for development)

`backend/dev/` contains a small fake Apps Script that runs `Code.gs` in Node with an in-memory "spreadsheet":

```bash
node backend/dev/server.js          # prints a secret key, listens on http://localhost:8787
```

In TrackIt (served from `http://localhost`), connect with the URL `http://localhost:8787/macros/s/TEST/exec` and the printed key. `http://localhost:8787/__dump` shows what the "sheet" contains.
