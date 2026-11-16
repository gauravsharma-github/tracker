// Small helpers: escaping, ids, icons, dates, durations and formatting.
(function (TI) {
  const U = {};

  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.icon = (name, cls = '') => `<span class="ms ${cls}" aria-hidden="true">${name}</span>`;
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.clone = (o) => JSON.parse(JSON.stringify(o));
  U.sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);
  U.groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
  U.debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.cssVar = (c) => (c ? `style="--c:${c}"` : '');

  // ---------- Dates (all local time) ----------
  const pad = (n) => String(n).padStart(2, '0');
  U.pad = pad;
  U.dayKey = (d = new Date()) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  U.parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  U.today = () => U.dayKey(new Date());
  U.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  U.addDaysKey = (k, n) => U.dayKey(U.addDays(U.parseDay(k), n));
  U.startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  U.endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  U.daysBetween = (a, b) => Math.round((U.startOfDay(b) - U.startOfDay(a)) / 86400000);
  U.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  U.MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  U.WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  U.WD1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  U.fmtDate = (d, opts = {}) => {
    d = new Date(d);
    const s = `${U.MONTHS[d.getMonth()]} ${d.getDate()}`;
    if (opts.year || d.getFullYear() !== new Date().getFullYear()) return `${s}, ${d.getFullYear()}`;
    return s;
  };
  U.fmtDay = (k) => {
    const diff = U.daysBetween(new Date(), U.parseDay(k));
    if (diff === 0) return 'Today';
    if (diff === -1) return 'Yesterday';
    if (diff === 1) return 'Tomorrow';
    const d = U.parseDay(k);
    return `${U.WD[d.getDay()]}, ${U.fmtDate(d)}`;
  };
  U.fmtTime = (d, h12 = true) => {
    d = new Date(d);
    if (!h12) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${h}:${pad(d.getMinutes())} ${ap}`;
  };
  U.hmToMin = (hm) => { const [h, m] = String(hm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  U.minToHm = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(Math.round(min % 60))}`;
  U.fmtHmLabel = (hm, h12 = true) => {
    const min = U.hmToMin(hm); let h = Math.floor(min / 60); const m = min % 60;
    if (!h12) return `${pad(h)}:${pad(m)}`;
    const ap = h >= 12 && h < 24 ? 'PM' : 'AM'; h = h % 12 || 12;
    return m ? `${h}:${pad(m)} ${ap}` : `${h} ${ap}`;
  };
  U.relDue = (ts) => {
    const now = Date.now();
    if (ts <= now) return 'Due now';
    const days = U.daysBetween(new Date(now), new Date(ts));
    if (days <= 0) { const mins = Math.round((ts - now) / 60000); return mins < 60 ? `In ${mins} min` : `In ${Math.round(mins / 60)} h`; }
    if (days === 1) return 'Tomorrow';
    if (days < 30) return `In ${days} days`;
    if (days < 365) return `In ${Math.round(days / 30)} mo`;
    return `In ${Math.round(days / 365)} yr`;
  };
  U.timeAgo = (ts) => {
    if (!ts) return 'Never';
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    const d = Math.floor(s / 86400);
    return d === 1 ? 'Yesterday' : d < 30 ? `${d} days ago` : U.fmtDate(ts);
  };

  // ---------- Durations ----------
  // "4h 00m", "2d 07h" (as the app shows Spent Total), "45m"
  U.fmtDur = (sec, opts = {}) => {
    sec = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(sec / 60); const h = Math.floor(m / 60);
    if (h >= 24 && !opts.noDays) return `${Math.floor(h / 24)}d ${pad(h % 24)}h`;
    if (opts.short && h === 0) return `${m}m`;
    return `${h}h ${pad(m % 60)}m`;
  };
  // "1:01" (hours:minutes) – used under dates in the date strip
  U.fmtHM = (sec) => { const m = Math.floor((sec || 0) / 60); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
  // "00:21:25"
  U.fmtClock = (sec, forceHours = true) => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
    return forceHours || h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };
  U.fmtMin = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`);

  // ---------- Numbers ----------
  U.pct = (x, dp = 1) => `${(Math.round((x || 0) * 100 * 10 ** dp) / 10 ** dp).toFixed(dp)}%`;
  U.pctInt = (x) => `${Math.round((x || 0) * 100)}%`;
  U.plural = (n, w, pl) => `${n} ${n === 1 ? w : pl || w + 's'}`;

  // ---------- Text ----------
  U.linkify = (text) => U.esc(text).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  U.nl2br = (s) => s.replace(/\n/g, '<br>');
  U.slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  U.truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  // ---------- Color ----------
  U.hexToRgb = (hex) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  U.rgba = (hex, a) => { const [r, g, b] = U.hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
  U.mix = (hex, hex2, t) => { const a = U.hexToRgb(hex); const b = U.hexToRgb(hex2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

  // ---------- Files ----------
  U.download = (name, data, type = 'application/json') => {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  U.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove(); return ok;
    }
  };
  U.readFile = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
  U.pickFile = (accept = '.json,application/json') => new Promise((res) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
    i.onchange = () => res(i.files && i.files[0] ? i.files[0] : null); i.click();
  });

  // Seeded PRNG (for repeatable demo data)
  U.rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  TI.util = U;
})(window.TI);
