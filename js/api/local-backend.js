// Backend #1: everything in this browser's localStorage (demo / offline mode).
(function (TI) {
  const S = TI.storage;
  const U = TI.util;
  const { COLLECTIONS, apply } = TI.ops;
  let db = null;

  function load() {
    if (db) return db;
    db = S.get('db');
    if (!db || !db.projects) { db = TI.seed.create(); persistNow(); }
    COLLECTIONS.forEach((c) => { if (!Array.isArray(db[c])) db[c] = []; });
    db.settings = { ...TI.seed.defaultSettings(), ...(db.settings || {}) };
    db.account = db.account || { signedIn: false, pro: false };
    return db;
  }
  function persistNow() { if (db) S.set('db', db); }
  const persist = U.debounce(persistNow, 120);
  window.addEventListener('beforeunload', persistNow);

  const write = (op) => { apply(load(), op); persist(); };

  TI.backends = TI.backends || {};
  TI.backends.local = {
    id: 'local',
    async loadAll() { return U.clone(load()); },
    async write(op) { write(op); },
    snapshot() { return U.clone(load()); },
    async replaceAll(data) {
      db = { ...U.clone(data), account: (db && db.account) || data.account || { pro: false } };
      load(); persistNow(); return U.clone(db);
    },
    // Account (mocked)
    getAccount() { return load().account; },
    setAccount(patch) { Object.assign(load().account, patch); persist(); return U.clone(db.account); },
    async resetDemo() { const acc = load().account; db = TI.seed.create(); db.account = acc; persistNow(); return U.clone(db); },
    async clearAll() {
      const keep = { settings: { ...load().settings, activeProjectId: null }, account: load().account };
      db = { ...keep }; COLLECTIONS.forEach((c) => { db[c] = []; }); persistNow(); return U.clone(db);
    },
  };
})(window.TI);
