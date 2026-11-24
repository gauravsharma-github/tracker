// Backend #2: your own Google Sheet, through the Apps Script web app in backend/Code.gs.
//
// How it stays fast and works offline:
//  • A full copy of your data is cached in this browser, so the app opens instantly.
//  • Every change is applied to that copy at once and added to a queue (also saved locally).
//  • The queue is sent to the script in batches a moment later; failed sends retry with backoff
//    and again when the browser comes back online.
//  • On start, on "Sync now" and when you return to the tab, the latest data is pulled from
//    the sheet (so changes made on your phone appear on your laptop) and any unsent changes
//    are replayed on top.
(function (TI) {
  const S = TI.storage;
  const U = TI.util;
  const { apply, COLLECTIONS, emptyDb, clone } = TI.ops;
  const K = { conn: 'conn', cache: 'sheets.cache', queue: 'sheets.queue', meta: 'sheets.meta' };

  let db = null;
  let queue = S.get(K.queue, []);
  const meta = Object.assign({ lastSync: null, lastPull: null, sheetUrl: null, account: { pro: true } }, S.get(K.meta, {}));
  let flushing = null; let refreshing = null; let flushTimer = null; let retryTimer = null; let retryDelay = 0;
  const status = { state: queue.length ? 'pending' : 'idle', pending: queue.length, lastSync: meta.lastSync, error: null };
  const statusFns = new Set(); let remoteFn = null;

  const conn = () => S.get(K.conn);
  const saveQueue = () => S.set(K.queue, queue);
  const saveMeta = () => S.set(K.meta, meta);
  const saveCache = U.debounce(() => { if (db) S.set(K.cache, db); }, 150);
  window.addEventListener('beforeunload', () => { if (db && conn()) S.set(K.cache, db); });

  function setStatus(patch) {
    Object.assign(status, patch, { pending: queue.length });
    statusFns.forEach((f) => { try { f({ ...status }); } catch (e) { console.error(e); } });
  }

  function normalize(data) {
    const d = emptyDb();
    COLLECTIONS.forEach((c) => { d[c] = Array.isArray(data && data[c]) ? data[c] : []; });
    d.settings = { ...TI.seed.defaultSettings(), ...((data && data.settings) || {}) };
    return d;
  }
  const withAccount = (d) => ({ ...d, account: { ...meta.account, signedIn: true, provider: 'sheets', lastBackup: meta.lastSync } });

  function friendly(e) {
    const m = String((e && e.message) || e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return navigator.onLine === false ? 'You are offline' : 'Could not reach the script. Check the web app URL, that access is set to "Anyone", and your connection.';
    return m;
  }

  // One request to the Apps Script web app. text/plain avoids the CORS preflight Apps Script can't answer.
  async function call(body, c = conn(), timeoutMs = 45000) {
    if (!c || !c.url) throw new Error('Not connected to a Google Sheet');
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(c.url, {
        method: 'POST', redirect: 'follow', signal: ctrl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...body, token: c.token, client: 'trackit-web/1' }),
      });
      if (!res.ok) throw new Error(`The script returned HTTP ${res.status}`);
      const text = await res.text();
      let j;
      try { j = JSON.parse(text); } catch (e) {
        throw new Error(/<html|<!doctype/i.test(text) ? 'That URL did not return TrackIt data. Use the web app URL ending in /exec and set access to "Anyone".' : 'Unexpected response from the script');
      }
      if (!j.ok) { const err = new Error(j.error || 'The script reported an error'); err.code = j.code; err.status = j.status; throw err; }
      return j;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('The request timed out');
      if (e.code) throw e; // the script's own error (with a code, e.g. AI rate limit) – keep it
      throw new Error(friendly(e));
    } finally { clearTimeout(t); }
  }

  function scheduleFlush(ms = 700) { clearTimeout(flushTimer); flushTimer = setTimeout(() => flush().catch(() => {}), ms); }
  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryDelay = Math.min(120000, retryDelay ? retryDelay * 2 : 4000);
    retryTimer = setTimeout(() => flush().catch(() => {}), retryDelay);
  }

  // Send queued changes in batches
  function flush() {
    if (flushing) return flushing;
    if (!queue.length || !conn()) return Promise.resolve();
    flushing = (async () => {
      try {
        while (queue.length) {
          const batch = queue.slice(0, 150);
          setStatus({ state: 'syncing', error: null });
          await call({ op: 'apply', ops: batch });
          queue.splice(0, batch.length); saveQueue();
          meta.lastSync = Date.now(); saveMeta();
        }
        retryDelay = 0;
        setStatus({ state: 'synced', error: null, lastSync: meta.lastSync });
      } catch (e) {
        setStatus({ state: navigator.onLine === false ? 'offline' : 'error', error: e.message });
        scheduleRetry();
        throw e;
      } finally { flushing = null; }
    })();
    return flushing;
  }

  // Pull the latest data from the sheet (after sending anything queued)
  function refresh({ initial = false } = {}) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      setStatus({ state: 'syncing', error: null });
      try {
        await flush();
        const j = await call({ op: 'bootstrap' });
        const fresh = normalize(j.data);
        queue.forEach((op) => apply(fresh, op)); // changes made while the request was in flight
        db = fresh; S.set(K.cache, db);
        meta.lastSync = Date.now(); meta.lastPull = meta.lastSync; if (j.sheetUrl) meta.sheetUrl = j.sheetUrl; meta.version = j.version || 1; saveMeta();
        setStatus({ state: queue.length ? 'pending' : 'synced', error: null, lastSync: meta.lastSync });
        if (!initial && remoteFn) remoteFn(withAccount(clone(db)));
        return db;
      } catch (e) {
        setStatus({ state: navigator.onLine === false ? 'offline' : 'error', error: e.message });
        if (queue.length) scheduleRetry();
        throw e;
      } finally { refreshing = null; }
    })();
    return refreshing;
  }

  window.addEventListener('online', () => { if (conn()) refresh().catch(() => {}); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && conn() && db && Date.now() - (meta.lastPull || 0) > 30000) refresh().catch(() => {});
  });

  TI.backends = TI.backends || {};
  TI.backends.sheets = {
    id: 'sheets',
    async loadAll() {
      db = S.get(K.cache);
      if (db) {
        db = normalize(db);
        setTimeout(() => refresh().catch(() => {}), 250);
        return withAccount(clone(db));
      }
      await refresh({ initial: true });
      return withAccount(clone(db));
    },
    async write(op) {
      if (!db) db = normalize(S.get(K.cache) || {});
      apply(db, op); saveCache();
      queue.push(op); saveQueue();
      setStatus({ state: status.state === 'syncing' ? 'syncing' : 'pending' });
      scheduleFlush();
    },
    snapshot() { return clone(db || normalize({})); },
    async replaceAll(data) {
      const d = normalize(data);
      await call({ op: 'replaceAll', data: d }, conn(), 120000);
      db = d; queue = []; saveQueue(); S.set(K.cache, db);
      meta.lastSync = Date.now(); meta.lastPull = meta.lastSync; saveMeta();
      setStatus({ state: 'synced', error: null, lastSync: meta.lastSync });
      return withAccount(clone(db));
    },
    async clearAll() { const keep = (db && db.settings) || {}; return this.replaceAll(emptyDb({ ...keep, activeProjectId: null })); },
    getAccount() { return withAccount({}).account; },
    setAccount(patch) { Object.assign(meta.account, patch); saveMeta(); return this.getAccount(); },
    // Connection helpers
    ping(c) { return call({ op: 'ping' }, c, 30000); },
    sendReplaceAll(c, data) { return call({ op: 'replaceAll', data: normalize(data) }, c, 120000); },
    refresh: () => refresh(),
    flush: () => flush(),
    status: () => ({ ...status }),
    onStatus(fn) { statusFns.add(fn); return () => statusFns.delete(fn); },
    onRemote(fn) { remoteFn = fn; },
    sheetUrl: () => meta.sheetUrl || (conn() && conn().sheetUrl) || null,
    version: () => meta.version || 1,
    // AI (Gemini) through the sheet's script – the API key stays in Script Properties
    ai: (req, timeoutMs = 120000) => call({ op: 'ai', ...req }, conn(), timeoutMs),
    aiStatus: () => call({ op: 'aiStatus' }, conn(), 30000),
    pending: () => queue.length,
    reset() { db = null; queue = []; saveQueue(); S.remove(K.cache); Object.assign(meta, { lastSync: null, lastPull: null, sheetUrl: null }); saveMeta(); setStatus({ state: 'idle', error: null, lastSync: null }); },
  };
})(window.TI);
