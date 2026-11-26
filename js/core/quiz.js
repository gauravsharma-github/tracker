// Quiz gate for the first three stages (Learn, Revision 1, Revision 2): a stage only turns green after scoring
// at least 80% on a quiz drawn from the topic's own multiple-choice questions (no AI).
//   mcq  { id, nodeId, subjectId, q, options: [..2–6], correct: index, why, createdAt, updatedAt }
//   quiz { id, nodeId, subjectId, projectId, stage (1–3), score, total, passed, at, answers: [{ id, chosen, ok }] }
(function (TI) {
  const U = TI.util;
  const PASS = 0.8;          // 80% to pass
  const MIN_BANK = 5;        // fewer questions than this: add more, or tick without a quiz
  const RETRY_HOURS = 2;     // wait after a failed attempt (revise first)
  const SIZES = [5, 10, 15];
  const QUIZ_STAGES = 3;     // stages 1–3 are quiz-gated

  const bank = (state, nodeId) => (state.mcqs || []).filter((m) => m.nodeId === nodeId);
  const attempts = (state, nodeId) => (state.quizzes || []).filter((a) => a.nodeId === nodeId).sort((a, b) => a.at - b.at);
  const sizeFor = (state, n) => {
    const s = n && state.subjects.find((x) => x.id === n.subjectId);
    const p = s && state.projects.find((x) => x.id === s.projectId);
    return (p && SIZES.includes(+p.quizLen) ? +p.quizLen : 10);
  };
  const passMark = (total) => Math.ceil(total * PASS - 1e-9);

  // Latest failed attempt at the topic's current stage (shown as a red tick) – null once passed/undone
  function failState(state, n) {
    const k = TI.stages.stageOf(n) + 1; if (k > QUIZ_STAGES) return null;
    const logs = TI.stages.logsOf(state, n.id); const since = logs.length ? logs[logs.length - 1].at : 0;
    const list = attempts(state, n.id).filter((a) => a.stage === k && a.at >= since);
    const last = list[list.length - 1];
    if (!last || last.passed) return null;
    return { ...last, retryAt: last.at + RETRY_HOURS * 3600000 };
  }

  // Pick questions: never-asked first, then ones answered wrongly most, then the rest; avoid the previous stage's set
  function pick(state, n, size) {
    const all = bank(state, n.id); if (!all.length) return [];
    const stats = new Map(all.map((m) => [m.id, { asked: 0, wrong: 0, lastAt: 0 }]));
    const hist = attempts(state, n.id);
    hist.forEach((a) => (a.answers || []).forEach((x) => { const s = stats.get(x.id); if (!s) return; s.asked++; if (!x.ok) s.wrong++; s.lastAt = Math.max(s.lastAt, a.at); }));
    const lastSet = new Set(hist.length ? (hist[hist.length - 1].answers || []).map((x) => x.id) : []);
    const score = (m) => { const s = stats.get(m.id); return (s.asked === 0 ? 100 : 0) + s.wrong * 10 - s.asked * 2 - (lastSet.has(m.id) && !s.wrong ? 25 : 0) + Math.random() * 6; };
    return all.slice().sort((a, b) => score(b) - score(a)).slice(0, Math.min(size, all.length))
      .sort(() => Math.random() - 0.5)
      .map((m) => { const order = m.options.map((_, i) => i).sort(() => Math.random() - 0.5); return { id: m.id, q: m.q, options: order.map((i) => m.options[i]), correct: order.indexOf(m.correct), why: m.why || '' }; });
  }

  // ---------- adding questions without AI ----------
  // Paste format: blocks separated by a blank line.
  //   Q: question (or "1. question" or just the first line)
  //   A) option   B) option *   (also "a.", "(c)", "- ")    * marks the right answer, or a line "Answer: B"
  //   Why: explanation (or "Explanation:")
  function parsePaste(text) {
    const out = []; const errors = [];
    const blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    blocks.forEach((b, bi) => {
      const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
      let q = ''; const options = []; let correct = -1; let why = ''; let ans = '';
      lines.forEach((l) => {
        let m;
        if ((m = l.match(/^(?:why|explanation|reason)\s*[:\-–]\s*(.*)$/i))) { why = m[1]; return; }
        if ((m = l.match(/^(?:answer|ans|correct)\s*[:\-–]\s*\(?([a-f])\)?\b/i))) { ans = m[1].toUpperCase(); return; }
        if ((m = l.match(/^\(?([a-fA-F])[).:\]]\s+(.+)$/)) || (q && (m = l.match(/^()[-•]\s+(.+)$/)))) {
          let t = m[2].trim(); const star = /\s*(\*|✓|✔|\(correct\))\s*$/i.test(t);
          t = t.replace(/\s*(\*|✓|✔|\(correct\))\s*$/i, '').trim();
          if (star) correct = options.length; options.push(t); return;
        }
        if (!options.length) { q = (q ? q + ' ' : '') + l.replace(/^(?:q(?:uestion)?\s*\d*\s*[:.)-]|\d+\s*[.)])\s*/i, ''); return; }
        if (why) why += ' ' + l;
      });
      if (ans) correct = ans.charCodeAt(0) - 65;
      const label = `Question ${bi + 1}${q ? ` (“${q.slice(0, 40)}${q.length > 40 ? '…' : ''}”)` : ''}`;
      if (!q) errors.push(`${label}: no question text`);
      else if (options.length < 2) errors.push(`${label}: needs at least 2 options like "A) …"`);
      else if (options.length > 6) errors.push(`${label}: at most 6 options`);
      else if (correct < 0 || correct >= options.length) errors.push(`${label}: mark the right option with * or add "Answer: B"`);
      else out.push({ q, options, correct, why: why.trim() });
    });
    return { list: out, errors };
  }

  // CSV: Topic, Question, Option A … Option F, Correct (A–F), Explanation
  const CSV_HEAD = ['Topic', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Option E', 'Option F', 'Correct (A-F)', 'Explanation'];
  const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function topicPath(state, n) { return TI.stats.pathOf(state, n.id).map((x) => x.title).join(' > '); }
  function csvTemplate(state, leaves) {
    const rows = [CSV_HEAD];
    leaves.forEach((n) => {
      const qs = bank(state, n.id);
      if (qs.length) qs.forEach((m) => rows.push([topicPath(state, n), m.q, ...[0, 1, 2, 3, 4, 5].map((i) => m.options[i] || ''), String.fromCharCode(65 + m.correct), m.why || '']));
      else rows.push([topicPath(state, n), '', '', '', '', '', '', '', '', '']);
    });
    return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  }
  function parseCsv(text) {
    const rows = []; let row = []; let cell = ''; let q = false; const s = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"') q = true; else if (c === ',' || c === ';' || c === '\t') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => String(x).trim()));
  }
  // Match CSV rows to topics: full path "Unit > Topic" (with or without the subject), else a unique topic title
  function importCsv(state, text, leaves) {
    const rows = parseCsv(text); if (!rows.length) return { items: [], errors: ['The file is empty'] };
    const head = rows[0].map((h) => String(h).trim().toLowerCase());
    const hasHead = head.includes('question');
    const col = (name, fb) => { const i = head.findIndex((h) => h.startsWith(name)); return hasHead && i >= 0 ? i : fb; };
    const ci = { topic: col('topic', 0), q: col('question', 1), a: col('option a', 2), corr: col('correct', 8), why: col('explanation', 9) };
    const norm = (x) => String(x || '').toLowerCase().replace(/\s*[›>/|]\s*/g, '>').replace(/\s+/g, ' ').trim();
    const byPath = new Map(); const byTitle = new Map();
    leaves.forEach((n) => {
      const path = TI.stats.pathOf(state, n.id).map((x) => x.title); const s = state.subjects.find((x) => x.id === n.subjectId);
      byPath.set(norm(path.join('>')), n); if (s) byPath.set(norm(s.name + '>' + path.join('>')), n);
      const t = norm(n.title); byTitle.set(t, byTitle.has(t) ? null : n);
    });
    const items = []; const errors = [];
    rows.slice(hasHead ? 1 : 0).forEach((r, i) => {
      const line = i + (hasHead ? 2 : 1); const q = String(r[ci.q] || '').trim(); if (!q) return;
      const t = norm(r[ci.topic]); const n = byPath.get(t) || byTitle.get(t) || (leaves.length === 1 && !t ? leaves[0] : null);
      if (!n) { errors.push(`Row ${line}: topic “${r[ci.topic] || ''}” not found`); return; }
      const options = [0, 1, 2, 3, 4, 5].map((k) => String(r[ci.a + k] || '').trim()).filter(Boolean);
      const c = String(r[ci.corr] || '').trim().toUpperCase(); const correct = /^[A-F]$/.test(c) ? c.charCodeAt(0) - 65 : /^\d$/.test(c) ? +c - 1 : -1;
      if (options.length < 2) { errors.push(`Row ${line}: needs at least 2 options`); return; }
      if (correct < 0 || correct >= options.length) { errors.push(`Row ${line}: “Correct” must be a letter A–${String.fromCharCode(64 + options.length)}`); return; }
      items.push({ nodeId: n.id, subjectId: n.subjectId, q, options, correct, why: String(r[ci.why] || '').trim() });
    });
    return { items, errors };
  }

  TI.quiz = { PASS, MIN_BANK, RETRY_HOURS, SIZES, QUIZ_STAGES, bank, attempts, sizeFor, passMark, failState, pick, parsePaste, csvTemplate, parseCsv, importCsv, topicPath };
})(window.TI);
