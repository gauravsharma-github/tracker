/**
 * @OnlyCurrentDoc
 *
 * TrackIt – Google Sheets backend (Apps Script web app)
 * ------------------------------------------------------
 * Paste this whole file into Extensions › Apps Script of an empty Google Sheet,
 * run setup() once, then Deploy › New deployment › Web app
 * (Execute as: Me, Who has access: Anyone). Full steps: backend/SETUP.md
 *
 * The web app accepts POST requests with a JSON body (sent as text/plain):
 *   { token, op: 'ping' }                      → counts of rows per tab
 *   { token, op: 'bootstrap' }                 → all data
 *   { token, op: 'apply', ops: [ ... ] }       → create / update / remove rows (see js/api/ops.js)
 *   { token, op: 'replaceAll', data: { ... } } → overwrite every tab
 * Every request must carry the secret key created by setup() (stored in Script Properties,
 * never in the web app code you host).
 *
 * "@OnlyCurrentDoc" limits the script to this one spreadsheet.
 */

var BACKEND_VERSION = 4;

// Column types: s = text, n = number, t = timestamp (ms), b = true/false, j = JSON text
var SCHEMA = {
  projects: [['id', 's'], ['name', 's'], ['category', 's'], ['color', 's'], ['templateId', 's'], ['order', 'n'], ['archived', 'b'], ['createdAt', 't'], ['updatedAt', 't']],
  subjects: [['id', 's'], ['projectId', 's'], ['name', 's'], ['color', 's'], ['order', 'n'], ['createdAt', 't']],
  nodes: [['id', 's'], ['subjectId', 's'], ['parentId', 's'], ['title', 's'], ['done', 'b'], ['doneAt', 't'], ['due', 's'], ['order', 'n'], ['createdAt', 't'], ['stage', 'n'], ['stageDue', 's']],
  sessions: [['id', 's'], ['projectId', 's'], ['subjectId', 's'], ['nodeId', 's'], ['start', 't'], ['duration', 'n'], ['mode', 's'], ['manual', 'b']],
  cards: [['id', 's'], ['subjectId', 's'], ['nodeId', 's'], ['front', 's'], ['back', 's'], ['ease', 'n'], ['interval', 'n'], ['reps', 'n'], ['lapses', 'n'], ['due', 't'], ['state', 's'], ['lastReviewed', 't'], ['createdAt', 't']],
  reviews: [['id', 's'], ['cardId', 's'], ['subjectId', 's'], ['grade', 's'], ['at', 't']],
  notes: [['id', 's'], ['subjectId', 's'], ['nodeId', 's'], ['title', 's'], ['body', 's'], ['pinned', 'b'], ['createdAt', 't'], ['updatedAt', 't']],
  blocks: [['id', 's'], ['date', 's'], ['start', 's'], ['end', 's'], ['subjectId', 's'], ['nodeId', 's'], ['title', 's'], ['repeat', 's'], ['until', 's'], ['doneDates', 'j'], ['skipDates', 'j'], ['createdAt', 't']],
  // v2: PDF / audio files kept in your GitHub repo (this tab only stores where they are)
  attachments: [['id', 's'], ['projectId', 's'], ['subjectId', 's'], ['nodeId', 's'], ['kind', 's'], ['name', 's'], ['path', 's'], ['repo', 's'], ['branch', 's'], ['sha', 's'], ['size', 'n'], ['mime', 's'], ['duration', 'n'], ['createdAt', 't'], ['updatedAt', 't']],
  // v3: five-stage mastery – one row per tick (Learn, Revision 1, Revision 2, Interview test, Re-practice)
  stages: [['id', 's'], ['nodeId', 's'], ['subjectId', 's'], ['projectId', 's'], ['stage', 'n'], ['result', 's'], ['at', 't'], ['early', 'b'], ['toStage', 'n'], ['prevStage', 'n'], ['prevDue', 's'], ['prevDone', 'b'], ['prevDoneAt', 't']],
};
var SETTINGS_TAB = 'settings';
var NULLABLE = { parentId: 1, nodeId: 1, templateId: 1, due: 1, until: 1, stageDue: 1, prevDue: 1 };
var TIME_TEXT = { start: 1, end: 1 };
var MAX_CELL = 49000;

// ---------------------------------------------------------------- Entry points

function doGet() {
  return ContentService.createTextOutput('TrackIt backend v' + BACKEND_VERSION + ' is running. Connect from TrackIt › Settings › Google Sheet.');
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'Bad request body' }); }
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token) return out_({ ok: false, error: 'The sheet is not set up yet. In Apps Script, run setup() once.' });
  if (!req || req.token !== token) return out_({ ok: false, error: 'Wrong secret key' });

  // AI calls don't touch the sheet, so they run without the lock (they can take 10–60 s)
  if (req.op === 'aiStatus') return out_(aiStatus_());
  if (req.op === 'ai') { try { return out_(aiCall_(req)); } catch (err) { return out_({ ok: false, code: 'ai_error', error: String((err && err.message) || err) }); } }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return out_({ ok: false, error: 'The sheet is busy. Please try again.' });
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    switch (req.op) {
      case 'ping': return out_({ ok: true, app: 'TrackIt', version: BACKEND_VERSION, counts: counts_(ss), sheetUrl: ss.getUrl(), sheetName: ss.getName() });
      case 'bootstrap': return out_({ ok: true, version: BACKEND_VERSION, data: readAll_(ss), sheetUrl: ss.getUrl(), serverTime: Date.now() });
      case 'apply': applyOps_(ss, req.ops || []); return out_({ ok: true, applied: (req.ops || []).length, serverTime: Date.now() });
      case 'replaceAll': replaceAll_(ss, req.data || {}); return out_({ ok: true, counts: counts_(ss) });
      default: return out_({ ok: false, error: 'Unknown operation: ' + req.op });
    }
  } catch (err) {
    return out_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- Setup & menu

/** Run once from the editor (or TrackIt › Set up tabs). Safe to run again. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SCHEMA).forEach(function (name) { table_(ss, name); });
  settingsTable_(ss);
  var first = ss.getSheetByName('Sheet1');
  if (first && ss.getSheets().length > 1 && first.getLastRow() === 0) ss.deleteSheet(first);
  var token = ensureToken_();
  Logger.log('TrackIt is set up. Secret key: ' + token);
  try {
    SpreadsheetApp.getUi().alert('TrackIt is set up', 'Secret key:\n\n' + token + '\n\nNext: Deploy › New deployment › Web app (Execute as: Me, Who has access: Anyone). Then open TrackIt › Connection details.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { /* run from the editor: see the execution log */ }
  return token;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('TrackIt')
    .addItem('Connection details', 'showConnection')
    .addItem('Set up / repair tabs', 'setup')
    .addSeparator()
    .addItem('Create a new secret key', 'rotateKey')
    .addSeparator()
    .addItem('Set Gemini API key (AI features)', 'setGeminiKey')
    .addItem('Choose AI model', 'chooseAiModel')
    .addItem('Test AI', 'testAi')
    .addToUi();
}

// ---------------------------------------------------------------- AI (Google Gemini)
// TrackIt sends prompts here; this script adds your Gemini API key (kept in Script Properties, never sent to the
// browser) and calls the Gemini API. Get a key at https://aistudio.google.com/apikey
var AI_DEFAULT_MODEL = 'gemini-flash-latest';

function aiCfg_() {
  var p = PropertiesService.getScriptProperties();
  return { key: p.getProperty('GEMINI_API_KEY') || '', model: p.getProperty('GEMINI_MODEL') || AI_DEFAULT_MODEL };
}

function aiStatus_() {
  var c = aiCfg_();
  return { ok: true, configured: !!c.key, model: c.model, provider: 'gemini', version: BACKEND_VERSION };
}

/** req: { system, contents: [{ role: 'user'|'model', parts: [{ text } | { inline_data: { mime_type, data } }] }], json, temperature, maxTokens } */
function aiCall_(req) {
  var c = aiCfg_();
  if (!c.key) return { ok: false, code: 'no_key', error: 'No Gemini API key yet. In your sheet open TrackIt › Set Gemini API key.' };
  var gen = { temperature: req.temperature == null ? 0.7 : Number(req.temperature), maxOutputTokens: Number(req.maxTokens) || 8192 };
  if (req.json) gen.responseMimeType = 'application/json';
  var body = { contents: req.contents || [], generationConfig: gen };
  if (req.system) body.systemInstruction = { parts: [{ text: String(req.system) }] };
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(req.model || c.model) + ':generateContent';
  var res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': c.key }, payload: JSON.stringify(body), muteHttpExceptions: true });
  var status = res.getResponseCode(); var txt = res.getContentText(); var j = null;
  try { j = JSON.parse(txt); } catch (e) { j = null; }
  if (status !== 200) {
    var msg = (j && j.error && j.error.message) || ('HTTP ' + status);
    var code = status === 429 ? 'rate_limit' : (status === 400 && /api key/i.test(msg)) || status === 401 || status === 403 ? 'bad_key' : status === 404 ? 'bad_model' : 'ai_error';
    return { ok: false, code: code, status: status, error: msg };
  }
  var cand = j && j.candidates && j.candidates[0];
  var text = cand && cand.content && cand.content.parts ? cand.content.parts.map(function (p) { return p.thought ? '' : (p.text || ''); }).join('') : '';
  if (!text) return { ok: false, code: 'empty', error: 'The AI returned no answer' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : '') + '. Try again.' };
  return { ok: true, text: text, model: req.model || c.model, finishReason: cand.finishReason || '', usage: j.usageMetadata || null };
}

function setGeminiKey() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Gemini API key', 'Paste your key from https://aistudio.google.com/apikey\n(It is stored in this script only. Leave empty and press OK to remove it.)', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var key = String(r.getResponseText() || '').trim();
  var p = PropertiesService.getScriptProperties();
  if (!key) { p.deleteProperty('GEMINI_API_KEY'); ui.alert('AI key removed.'); return; }
  p.setProperty('GEMINI_API_KEY', key);
  testAi();
}

function chooseAiModel() {
  var ui = SpreadsheetApp.getUi(); var c = aiCfg_();
  var r = ui.prompt('AI model', 'Current: ' + c.model + '\n\nType a Gemini model id (for example gemini-flash-latest), or leave empty for the default (' + AI_DEFAULT_MODEL + ').', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var m = String(r.getResponseText() || '').trim();
  if (m) PropertiesService.getScriptProperties().setProperty('GEMINI_MODEL', m); else PropertiesService.getScriptProperties().deleteProperty('GEMINI_MODEL');
  testAi();
}

function testAi() {
  var r = aiCall_({ contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: TrackIt AI is ready' }] }], temperature: 0, maxTokens: 256 });
  var msg = r.ok ? 'Working ✓  (' + r.model + ')\n\n' + r.text : 'Not working: ' + r.error;
  try { SpreadsheetApp.getUi().alert('TrackIt AI', msg + (r.ok ? '\n\nNow deploy a new version (Deploy › Manage deployments › ✏️ › New version) if you have not yet.' : ''), SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { Logger.log(msg); }
  return r;
}

function showConnection() {
  var ui = SpreadsheetApp.getUi();
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { url = ''; }
  ui.alert('TrackIt connection',
    'Web app URL:\n' + (url || '(not deployed yet – Deploy › New deployment › Web app)') +
    (url && /\/dev$/.test(url) ? '\n(This is the test URL. Copy the one ending in /exec from Deploy › Manage deployments.)' : '') +
    (url ? '\n(Google sometimes shows an older deployment here. If it does not open, copy the Web app URL from Deploy › Manage deployments instead.)' : '') +
    '\n\nSecret key:\n' + ensureToken_() +
    '\n\nIn TrackIt open Settings › Google Sheet › Connect and paste both.', ui.ButtonSet.OK);
}

function rotateKey() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('Create a new secret key?', 'Every device connected with the old key will stop syncing until you reconnect it with the new key.', ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().setProperty('TOKEN', newToken_());
  showConnection();
}

function ensureToken_() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TOKEN');
  if (!token) { token = newToken_(); props.setProperty('TOKEN', token); }
  return token;
}
function newToken_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 40); }

// ---------------------------------------------------------------- Tables

function colsOf_(name) { return (SCHEMA[name] || [['id', 's']]).concat([['extra', 'j']]); }

// Collections added by newer app versions get a simple tab (id + extra JSON) automatically,
// so an older script never blocks syncing. Their names are remembered in Script Properties.
function isCollName_(name) { return SCHEMA[name] || /^[a-z][A-Za-z0-9]{1,30}$/.test(String(name || '')); }
function extraColls_() { var v = PropertiesService.getScriptProperties().getProperty('EXTRA_COLLS'); return v ? v.split(',').filter(String) : []; }
function rememberColl_(name) {
  if (SCHEMA[name] || name === SETTINGS_TAB) return;
  var list = extraColls_(); if (list.indexOf(name) >= 0) return;
  list.push(name); PropertiesService.getScriptProperties().setProperty('EXTRA_COLLS', list.join(','));
}
function allColls_() { return Object.keys(SCHEMA).concat(extraColls_().filter(function (n) { return !SCHEMA[n]; })); }

// Opens (or creates) a tab and makes sure every schema column has a header.
// Columns are located by header name, so you may reorder them or add your own columns.
function table_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var cols = colsOf_(name);
  var lastCol = sh.getLastColumn();
  var headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  var missing = cols.filter(function (c) { return headers.indexOf(c[0]) < 0; }).map(function (c) { return c[0]; });
  if (missing.length) {
    headers = headers.concat(missing);
    if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  var types = {};
  cols.forEach(function (c) { types[c[0]] = c[1]; });
  return { sh: sh, name: name, headers: headers, types: types };
}

function load_(ss, name) {
  var t = table_(ss, name);
  var last = t.sh.getLastRow();
  var raws = last >= 2 ? t.sh.getRange(2, 1, last - 1, t.headers.length).getValues() : [];
  var idI = t.headers.indexOf('id');
  var rows = [];
  raws.forEach(function (raw) { if (raw[idI] !== '' && raw[idI] !== null) rows.push({ o: fromRow_(t, raw), raw: raw }); });
  var index = {};
  rows.forEach(function (r, i) { index[r.o.id] = i; });
  return { t: t, rows: rows, index: index, oldLast: last, startCount: rows.length, changed: false, appendOnly: true };
}

function readColl_(ss, name) { return load_(ss, name).rows.map(function (r) { return r.o; }); }

function save_(c) {
  if (!c.changed) return;
  var t = c.t;
  var width = t.headers.length;
  if (c.appendOnly) {
    var added = c.rows.slice(c.startCount);
    if (!added.length) return;
    var start = c.oldLast + 1 < 2 ? 2 : c.oldLast + 1;
    writeRows_(t, start, added.map(function (r) { return toRow_(t, r.o, r.raw); }));
    return;
  }
  var values = c.rows.map(function (r) { return toRow_(t, r.o, r.raw); });
  if (c.oldLast >= 2) t.sh.getRange(2, 1, c.oldLast - 1, width).clearContent();
  if (values.length) writeRows_(t, 2, values);
}

function writeRows_(t, startRow, values) {
  var sh = t.sh; var n = values.length; var width = t.headers.length;
  var need = startRow + n - 1;
  if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 50);
  // Text columns stay plain text so "07:00" or "2026-11-16" are not turned into dates
  t.headers.forEach(function (h, i) {
    var ty = t.types[h];
    if (ty === 's' || ty === 'j') sh.getRange(startRow, i + 1, n, 1).setNumberFormat('@');
    else if (ty === 't') sh.getRange(startRow, i + 1, n, 1).setNumberFormat('0');
  });
  sh.getRange(startRow, 1, n, width).setValues(values);
}

// ---------------------------------------------------------------- Value conversion

function fromRow_(t, raw) {
  var o = {};
  t.headers.forEach(function (h, i) {
    var ty = t.types[h];
    if (!ty) return; // your own extra columns are ignored
    var v = raw[i];
    if (h === 'extra') {
      if (v) { try { var x = JSON.parse(v); for (var k in x) if (!(k in t.types)) o[k] = x[k]; } catch (e) { /* ignore */ } }
      return;
    }
    o[h] = decode_(h, v, ty);
  });
  return o;
}

function decode_(h, v, ty) {
  if (v === '' || v === null || v === undefined) return ty === 'b' ? false : ty === 's' ? (NULLABLE[h] ? null : '') : null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (ty === 'n' || ty === 't') return v.getTime();
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return Utilities.formatDate(v, tz, TIME_TEXT[h] ? 'HH:mm' : 'yyyy-MM-dd');
  }
  switch (ty) {
    case 'n': case 't': { var n = typeof v === 'number' ? v : Number(v); return isNaN(n) ? null : n; }
    case 'b': return v === true || v === 'TRUE' || v === 'true' || v === 1;
    case 'j': try { return JSON.parse(v); } catch (e) { return null; }
    default: { var s = String(v); return /^'[=+\-@]/.test(s) ? s.slice(1) : s; }
  }
}

function encode_(v, ty) {
  if (v === null || v === undefined) return '';
  switch (ty) {
    case 'n': case 't': { var n = typeof v === 'number' ? v : Number(v); return isNaN(n) ? '' : n; }
    case 'b': return !!v;
    case 'j': return clip_(JSON.stringify(v));
    default: { var s = clip_(String(v)); return /^[=+\-@]/.test(s) ? "'" + s : s; }
  }
}
function clip_(s) { return s.length > MAX_CELL ? s.slice(0, MAX_CELL) + '…' : s; }

function toRow_(t, o, raw) {
  var extra = {};
  for (var k in o) if (!(k in t.types)) extra[k] = o[k];
  var hasExtra = Object.keys(extra).length > 0;
  return t.headers.map(function (h, i) {
    var ty = t.types[h];
    if (!ty) return raw ? raw[i] : ''; // keep values in your own columns
    if (h === 'extra') return hasExtra ? clip_(JSON.stringify(extra)) : '';
    return encode_(o[h], ty);
  });
}

// ---------------------------------------------------------------- Operations

function applyOps_(ss, ops) {
  var cache = {}; var settingsPatch = null;
  ops.forEach(function (op) {
    if (op.op === 'settings') { settingsPatch = Object.assign(settingsPatch || {}, op.patch || {}); return; }
    if (!isCollName_(op.coll) || op.coll === SETTINGS_TAB) throw new Error('Unknown collection: ' + op.coll);
    rememberColl_(op.coll);
    var c = cache[op.coll] || (cache[op.coll] = load_(ss, op.coll));
    switch (op.op) {
      case 'create': upsert_(c, op.item); break;
      case 'createMany': (op.items || []).forEach(function (it) { upsert_(c, it); }); break;
      case 'update': patch_(c, op.id, op.patch || {}); break;
      case 'updateMany': (op.patches || []).forEach(function (p) { patch_(c, p.id, p); }); break;
      case 'remove': remove_(c, op.ids || []); break;
      default: throw new Error('Unknown op: ' + op.op);
    }
  });
  Object.keys(cache).forEach(function (k) { save_(cache[k]); });
  if (settingsPatch) saveSettings_(ss, settingsPatch, false);
}

// Creating an id that already exists updates it instead, so a retried request never duplicates rows
function upsert_(c, item) {
  if (!item || !item.id) return;
  if (c.index.hasOwnProperty(item.id)) { patch_(c, item.id, item); return; }
  c.rows.push({ o: JSON.parse(JSON.stringify(item)), raw: null });
  c.index[item.id] = c.rows.length - 1;
  c.changed = true;
}
function patch_(c, id, p) {
  if (!c.index.hasOwnProperty(id)) return;
  var o = c.rows[c.index[id]].o;
  for (var k in p) o[k] = p[k];
  c.changed = true; c.appendOnly = false;
}
function remove_(c, ids) {
  var drop = {}; ids.forEach(function (id) { drop[id] = 1; });
  var before = c.rows.length;
  c.rows = c.rows.filter(function (r) { return !drop[r.o.id]; });
  if (c.rows.length === before) return;
  c.index = {}; c.rows.forEach(function (r, i) { c.index[r.o.id] = i; });
  c.changed = true; c.appendOnly = false;
}

function readAll_(ss) {
  var data = {};
  allColls_().forEach(function (name) { data[name] = readColl_(ss, name); });
  data.settings = readSettings_(ss);
  return data;
}

function counts_(ss) {
  var out = {};
  allColls_().forEach(function (name) { out[name] = load_(ss, name).rows.length; });
  return out;
}

function replaceAll_(ss, data) {
  Object.keys(data).forEach(function (k) { if (k !== 'settings' && Array.isArray(data[k]) && isCollName_(k)) rememberColl_(k); });
  allColls_().forEach(function (name) {
    var c = load_(ss, name);
    var items = Array.isArray(data[name]) ? data[name] : [];
    var keepRaw = {}; c.rows.forEach(function (r) { keepRaw[r.o.id] = r.raw; });
    c.rows = items.filter(function (it) { return it && it.id; }).map(function (it) { return { o: it, raw: keepRaw[it.id] || null }; });
    c.changed = true; c.appendOnly = false;
    save_(c);
  });
  saveSettings_(ss, data.settings || {}, true);
}

// ---------------------------------------------------------------- Settings (key / value)

function settingsTable_(ss) {
  var sh = ss.getSheetByName(SETTINGS_TAB);
  if (!sh) sh = ss.insertSheet(SETTINGS_TAB);
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, 2).setValues([['key', 'value']]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}

function readSettings_(ss) {
  var sh = settingsTable_(ss);
  var last = sh.getLastRow(); var out = {};
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) {
    if (r[0] === '' || r[0] === null) return;
    try { out[String(r[0])] = JSON.parse(r[1]); } catch (e) { out[String(r[0])] = r[1]; }
  });
  return out;
}

function saveSettings_(ss, patch, replace) {
  var sh = settingsTable_(ss);
  var current = replace ? {} : readSettings_(ss);
  for (var k in patch) current[k] = patch[k];
  var keys = Object.keys(current).sort();
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 2).clearContent();
  if (!keys.length) return;
  if (sh.getMaxRows() < keys.length + 1) sh.insertRowsAfter(sh.getMaxRows(), keys.length + 1 - sh.getMaxRows());
  var range = sh.getRange(2, 1, keys.length, 2);
  range.setNumberFormat('@');
  range.setValues(keys.map(function (k) { return [k, JSON.stringify(current[k])]; }));
}
