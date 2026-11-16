// localStorage wrapper with an in-memory fallback (private mode, file:// quirks, quota errors).
// Only js/api/api.js and a few UI-state helpers use this; screens never touch storage.
(function (TI) {
  const prefix = TI.config.storagePrefix;
  const mem = {};
  let ok = true;
  try { const k = prefix + '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); } catch (e) { ok = false; }

  TI.storage = {
    available: ok,
    get(key, fallback = null) {
      try {
        const raw = ok ? localStorage.getItem(prefix + key) : mem[key];
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      if (ok) {
        try { localStorage.setItem(prefix + key, raw); return true; } catch (e) { mem[key] = raw; return false; }
      }
      mem[key] = raw; return true;
    },
    remove(key) { if (ok) { try { localStorage.removeItem(prefix + key); } catch (e) { /* ignore */ } } delete mem[key]; },
    bytesUsed() {
      if (!ok) return 0;
      let n = 0;
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(prefix)) n += k.length + (localStorage.getItem(k) || '').length; }
      return n * 2;
    },
  };
})(window.TI);
