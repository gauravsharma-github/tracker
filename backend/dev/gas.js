// Development only: a minimal in-memory imitation of the Google services Code.gs uses
// (SpreadsheetApp, PropertiesService, LockService, ContentService…), including the way Sheets
// turns text like "2026-11-16" or "07:00" into dates unless a column is plain text.
const fs = require('fs'); const vm = require('vm');
function makeSheet(name) {
  const sh = { name, cells: [], formats: {}, maxRows: 1000, maxCols: 26, frozen: 0 };
  const get = (r, c) => (sh.cells[r - 1] && sh.cells[r - 1][c - 1] !== undefined ? sh.cells[r - 1][c - 1] : '');
  const put = (r, c, v) => { if (!sh.cells[r - 1]) sh.cells[r - 1] = []; sh.cells[r - 1][c - 1] = v; };
  const parse = (v, fmt) => {
    if (typeof v !== 'string') return v;
    if (v.startsWith("'")) return v.slice(1);              // apostrophe forces text
    if (fmt === '@') return v;                              // plain text column
    if (v.startsWith('=')) return '#ERROR!';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00');
    if (/^\d{1,2}:\d{2}$/.test(v)) { const [h, m] = v.split(':').map(Number); return new Date(1899, 11, 30, h, m); }
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (v === 'TRUE' || v === 'FALSE') return v === 'TRUE';
    return v;
  };
  const range = (r, c, nr = 1, nc = 1) => {
    if (r < 1 || c < 1 || r + nr - 1 > sh.maxRows || c + nc - 1 > sh.maxCols) throw new Error(`Range out of bounds on ${name}: ${r},${c},${nr},${nc} (max ${sh.maxRows}x${sh.maxCols})`);
    const R = {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => get(r + i, c + j))),
      setValues: (vals) => {
        if (vals.length !== nr || vals.some((row) => row.length !== nc)) throw new Error(`setValues size mismatch on ${name}: want ${nr}x${nc}`);
        vals.forEach((row, i) => row.forEach((v, j) => put(r + i, c + j, parse(v === null || v === undefined ? '' : v, sh.formats[`${r + i},${c + j}`]))));
        return R;
      },
      setNumberFormat: (f) => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sh.formats[`${r + i},${c + j}`] = f; return R; },
      setFontWeight: () => R,
      clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) put(r + i, c + j, ''); return R; },
    };
    return R;
  };
  return {
    _sh: sh, getName: () => name,
    getRange: range,
    getLastRow: () => { for (let i = sh.cells.length; i > 0; i--) if (sh.cells[i - 1] && sh.cells[i - 1].some((v) => v !== '' && v !== undefined)) return i; return 0; },
    getLastColumn: () => { let m = 0; sh.cells.forEach((row) => row && row.forEach((v, j) => { if (v !== '' && v !== undefined) m = Math.max(m, j + 1); })); return m; },
    getMaxRows: () => sh.maxRows, getMaxColumns: () => sh.maxCols,
    insertRowsAfter: (after, n) => { sh.maxRows += n; },
    insertColumnsAfter: (after, n) => { sh.maxCols += n; },
    setFrozenRows: (n) => { sh.frozen = n; },
  };
}
function makeEnv(state) {
  state.sheets = state.sheets || { Sheet1: makeSheet('Sheet1') };
  state.props = state.props || {};
  const ss = {
    getSheetByName: (n) => state.sheets[n] || null,
    insertSheet: (n) => (state.sheets[n] = makeSheet(n)),
    getSheets: () => Object.values(state.sheets),
    deleteSheet: (s) => { delete state.sheets[s.getName()]; },
    getUrl: () => 'https://docs.google.com/spreadsheets/d/FAKE/edit', getName: () => 'TrackIt data',
    getSpreadsheetTimeZone: () => 'Asia/Kolkata',
  };
  const pad = (n) => String(n).padStart(2, '0');
  const ctx = {
    console, JSON, Date, Math, Object, Array, String, Number, isNaN,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => { throw new Error('No UI in this context'); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => state.props[k] || null, setProperty: (k, v) => { state.props[k] = v; }, deleteProperty: (k) => { delete state.props[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock: () => {} }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (s) => { const o = { content: s, mime: 'text/plain', setMimeType(m) { o.mime = m; return o; }, getContent: () => s }; return o; } },
    Utilities: { getUuid: () => require('crypto').randomUUID(), formatDate: (d, tz, f) => f === 'HH:mm' ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` },
    Logger: { log: (...a) => console.log('[Logger]', ...a) },
    ScriptApp: { getService: () => ({ getUrl: () => 'http://localhost/exec' }) },
    // No network from here: AI calls get a canned answer so the dev server works offline
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"questions":[{"q":"Sample question?","a":"Sample answer."}],"say":"Sample interviewer question?","kind":"question","main":1,"score":70,"verdict":"shaky","summary":"Sample report.","strengths":[],"gaps":[],"questions_scored":[],"studyNext":[]}' }] } }] }) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(process.env.CODE_GS || require('path').join(__dirname, '..', 'Code.gs'), 'utf8'), ctx);
  return { ctx, ss, state };
}
module.exports = { makeEnv };
