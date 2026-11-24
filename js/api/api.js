// ⇦ DATA-ACCESS LAYER. Screens and the store only ever talk to TI.api.
// Two backends sit behind it:
//   • local  – this browser's localStorage (demo data, works offline)       js/api/local-backend.js
//   • sheets – your own Google Sheet via an Apps Script web app             js/api/sheets-backend.js
// The Sheets connection (web app URL + secret key) is stored only in this browser,
// never in the code, so the app can be hosted publicly (e.g. GitHub Pages).
(function (TI) {
  const S = TI.storage;
  const U = TI.util;
  const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  const local = () => TI.backends.local;
  const sheets = () => TI.backends.sheets;
  const backend = () => (S.get('conn') ? sheets() : local());
  const w = (op) => Promise.resolve(backend().write(op));

  const CODE_PREFIX = 'TRACKIT1:';
  // A connection code carries the sheet URL + key and, if set up, the GitHub attachment settings
  function encodeCode(url, token, gh) { return CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify({ u: url, t: token, ...(gh ? { g: gh } : {}) })))); }
  function decodeCode(code) {
    const c = String(code || '').trim();
    if (!c.startsWith(CODE_PREFIX)) return null;
    try { const o = JSON.parse(decodeURIComponent(escape(atob(c.slice(CODE_PREFIX.length))))); return o.u && o.t ? { url: o.u, token: o.t, gh: o.g || null } : null; } catch (e) { return null; }
  }
  function validUrl(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?$/.test(url) || /^https:\/\/script\.google\.com\/a\/macros\/[\w.-]+\/s\/[\w-]+\/exec\/?$/.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
  }

  const api = {
    mode: () => backend().id,

    // GET everything (bootstrap)
    loadAll: () => backend().loadAll(),
    // Writes
    create: (coll, item) => w({ op: 'create', coll, item }),
    createMany: (coll, items) => w({ op: 'createMany', coll, items }),
    update: (coll, id, patch) => w({ op: 'update', coll, id, patch }),
    updateMany: (coll, patches) => w({ op: 'updateMany', coll, patches }),
    remove: (coll, ids) => w({ op: 'remove', coll, ids: [].concat(ids) }),
    updateSettings: (patch) => w({ op: 'settings', patch }),

    // ---- Account (mocked in local mode) ----
    async signIn(provider) { await wait(700); return backend().setAccount({ signedIn: true, provider, name: 'Study Buddy', email: 'you@example.com' }); },
    async signOut() { await wait(200); return backend().setAccount({ signedIn: false, provider: null, name: '', email: '' }); },
    async backupNow() {
      if (api.mode() === 'sheets') { await sheets().refresh(); return Date.now(); }
      await wait(900); const t = Date.now(); backend().setAccount({ lastBackup: t }); return t;
    },
    async purchasePro(planId) { await wait(1100); return backend().setAccount({ pro: true, plan: planId, purchasedAt: Date.now() }); },
    async restorePurchase() { await wait(800); return backend().getAccount(); },
    async cancelProForTesting() { return backend().setAccount({ pro: false, plan: null }); },

    // ---- Templates ----
    async listTemplates() { return TI.templates; },

    // ---- Backup files ----
    async exportAll() { const d = backend().snapshot(); delete d.account; return { app: TI.config.appName, version: 1, exportedAt: new Date().toISOString(), data: d }; },
    async importAll(json) {
      const d = json && json.data ? json.data : json;
      if (!d || !Array.isArray(d.projects)) throw new Error('Not a TrackIt backup file');
      return backend().replaceAll(d);
    },
    async resetDemo() { return local().resetDemo(); },
    async clearAll() { return backend().clearAll(); },

    // ---- Google Sheets connection ----
    connection() { const c = S.get('conn'); return c ? { url: c.url, connectedAt: c.connectedAt, sheetUrl: sheets().sheetUrl() } : null; },
    validUrl, encodeCode, decodeCode,
    connectionCode() { const c = S.get('conn'); return c ? encodeCode(c.url, c.token, TI.github && TI.github.configured() ? TI.github.cfg() : null) : ''; },
    // Step 1: check the URL + key and see what the sheet already holds
    async testConnection(url, token) {
      if (!validUrl(url)) throw new Error('That does not look like an Apps Script web app URL (it should end in /exec).');
      if (!token) throw new Error('Enter the secret key shown in your sheet (TrackIt › Connection details).');
      return sheets().ping({ url, token });
    },
    // Step 2: connect. initial = 'remote' (use the sheet's data) | 'upload' (send this browser's data) | 'empty'
    async connect({ url, token, initial }) {
      const c = { url, token, connectedAt: Date.now() };
      if (initial === 'upload') await sheets().sendReplaceAll(c, local().snapshot());
      if (initial === 'empty') await sheets().sendReplaceAll(c, TI.ops.emptyDb({ ...local().snapshot().settings, activeProjectId: null }));
      sheets().reset();
      S.set('conn', c);
      return true;
    },
    // Back to browser-only mode. The latest synced copy is kept locally so nothing disappears.
    async disconnect({ keepCopy = true } = {}) {
      try { await sheets().flush(); } catch (e) { /* keep going */ }
      if (keepCopy) await local().replaceAll(sheets().snapshot());
      S.remove('conn'); sheets().reset();
    },
    // Apps Script version of the connected sheet (attachments need v2)
    backendVersion: () => (api.mode() === 'sheets' ? sheets().version() : 99),
    ai: (req) => { if (api.mode() !== 'sheets') { const e = new Error('Connect your Google Sheet to use AI (Settings › Google Sheet backend).'); e.code = 'no_sheet'; return Promise.reject(e); } return sheets().ai(req); },
    aiStatus: () => (api.mode() === 'sheets' ? sheets().aiStatus() : Promise.resolve({ ok: true, configured: false, noSheet: true })),
    syncNow: () => (api.mode() === 'sheets' ? sheets().refresh() : Promise.resolve()),
    syncStatus: () => (api.mode() === 'sheets' ? sheets().status() : null),
    onSyncStatus: (fn) => sheets().onStatus(fn),
    onRemoteData: (fn) => sheets().onRemote(fn),
  };

  TI.api = api;
})(window.TI);
