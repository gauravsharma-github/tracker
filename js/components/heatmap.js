// Progress heatmap: one square per day (columns = weeks), coloured by how many activities happened.
// Activities: topic stage ticked (Learn, revisions, interview test, re-practice), study session, flashcard reviewed,
// flashcard created, note written, file attached.
// Used on the all-projects Dashboard (scope 'all') and in each project view (scope = project id).
(function (TI) {
  const U = TI.util;
  const { state } = TI.store;
  const KINDS = [
    ['stages', 'topic stage done', 'topic stages done'],
    ['sessions', 'study session', 'study sessions'],
    ['reviews', 'card reviewed', 'cards reviewed'],
    ['cards', 'card created', 'cards created'],
    ['notes', 'note written', 'notes written'],
    ['files', 'file attached', 'files attached'],
  ];
  const LEVELS = [1, 3, 6, 10]; // 1–2 · 3–5 · 6–9 · 10+
  const offsets = {}; // scope -> pages back from today (not saved)
  let cache = { rev: -1, map: null };

  // Map scope -> Map(dayKey -> {total, topics, sessions, ...})
  function counts(scope) {
    if (cache.rev !== state.rev) cache = { rev: state.rev, map: new Map() };
    if (cache.map.has(scope)) return cache.map.get(scope);
    const subj = new Map(state.subjects.map((s) => [s.id, s.projectId]));
    const inScope = (pid) => scope === 'all' || pid === scope;
    const days = new Map(); let total = 0;
    const add = (pid, ts, kind) => {
      if (!ts || !inScope(pid)) return;
      const k = U.dayKey(ts); let d = days.get(k);
      if (!d) { d = { total: 0 }; days.set(k, d); }
      d.total++; d[kind] = (d[kind] || 0) + 1; total++;
    };
    (state.stages || []).forEach((l) => add(l.projectId || subj.get(l.subjectId), l.at, 'stages'));
    state.sessions.forEach((s) => add(s.projectId || subj.get(s.subjectId), s.start, 'sessions'));
    state.reviews.forEach((r) => add(subj.get(r.subjectId), r.at, 'reviews'));
    state.cards.forEach((c) => add(subj.get(c.subjectId), c.createdAt, 'cards'));
    state.notes.forEach((m) => add(subj.get(m.subjectId), m.createdAt || m.updatedAt, 'notes'));
    (state.attachments || []).forEach((a) => add(a.projectId || subj.get(a.subjectId), a.createdAt, 'files'));
    const first = days.size ? [...days.keys()].sort()[0] : null;
    const res = { days, total, first };
    cache.map.set(scope, res);
    return res;
  }

  const level = (n) => (n <= 0 ? 0 : n < LEVELS[1] ? 1 : n < LEVELS[2] ? 2 : n < LEVELS[3] ? 3 : 4);

  function tip(k, d) {
    const head = U.fmtDay(k);
    if (!d || !d.total) return `${head} · no activity`;
    const parts = KINDS.filter(([id]) => d[id]).map(([id, one, many]) => `${d[id]} ${d[id] === 1 ? one : many}`);
    return `${head} · ${U.plural(d.total, 'activity', 'activities')}: ${parts.join(', ')}`;
  }

  // weeks: columns shown per page
  function render(scope, { weeks = 20, title = 'Progress Heatmap', compact = false } = {}) {
    const c = counts(scope);
    const off = offsets[scope] || 0;
    const ws = state.settings.weekStart === 0 ? 0 : 1;
    const today = U.today();
    const t = U.parseDay(today);
    const back = (t.getDay() - ws + 7) % 7;               // days since this week started
    const lastColStart = U.addDays(t, -back - off * weeks * 7);
    const start = U.addDays(lastColStart, -(weeks - 1) * 7);
    const startKey = U.dayKey(start);
    const endKey = U.dayKey(U.addDays(lastColStart, 6));
    let cells = ''; let inWin = 0;
    for (let i = 0; i < weeks * 7; i++) {
      const k = U.addDaysKey(startKey, i);
      if (k > today) { cells += `<i class="hm-c future" title="${U.esc(U.fmtDay(k))}"></i>`; continue; }
      const d = c.days.get(k); const n = d ? d.total : 0; inWin += n;
      cells += `<i class="hm-c l${level(n)}${k === today ? ' today' : ''}" title="${U.esc(tip(k, d))}"></i>`;
    }
    const canPrev = !!c.first && c.first < startKey;
    const canNext = off > 0;
    const range = `${U.fmtDate(start, { short: true })} – ${U.fmtDate(U.parseDay(endKey > today ? today : endKey), { short: true })}`;
    const months = monthLabels(startKey, weeks);
    return `<div class="card pheat ${compact ? 'compact' : ''}" data-scope="${U.esc(scope)}">
      <div class="hm-head">
        <h3>${U.esc(title)}</h3>
        <div class="hm-nav">
          <button class="hm-btn" data-act="hm-page" data-scope="${U.esc(scope)}" data-d="1" ${canPrev ? '' : 'disabled'}>Prev</button>
          <button class="hm-btn" data-act="hm-page" data-scope="${U.esc(scope)}" data-d="-1" ${canNext ? '' : 'disabled'}>Next</button>
        </div>
      </div>
      <div class="hm-sub">${c.total ? `Crushed ${c.total.toLocaleString()} ${c.total === 1 ? 'activity' : 'activities'} so far!` : 'Your first activity lights up a square'}</div>
      <div class="hm-box">
        <div class="hm-months" style="--w:${weeks}">${months}</div>
        <div class="hm-grid" style="--w:${weeks}" role="img" aria-label="${U.esc(`${range}: ${inWin} activities`)}">${cells}</div>
        <div class="hm-range">${U.esc(range)} · ${U.plural(inWin, 'activity', 'activities')}</div>
      </div>
      <div class="hm-foot">
        <button class="hm-learn" data-act="hm-learn">Learn how we count activities</button>
        <div class="hm-legend"><span>Less</span><i class="hm-c l0"></i><i class="hm-c l1"></i><i class="hm-c l2"></i><i class="hm-c l3"></i><i class="hm-c l4"></i><span>More</span></div>
      </div>
    </div>`;
  }

  // Month name above the first column that starts in a new month
  function monthLabels(startKey, weeks) {
    let out = ''; let prev = -1;
    for (let w = 0; w < weeks; w++) {
      const d = U.parseDay(U.addDaysKey(startKey, w * 7 + 6));
      const m = d.getMonth();
      out += `<span>${m !== prev && w < weeks - 1 ? U.MONTHS[m] : ''}</span>`;
      prev = m;
    }
    return out;
  }

  function learn() {
    TI.ui.dialog({
      title: 'How we count activities',
      html: `<p>Each square is one day. Every one of these counts as one activity on the day it happened:</p>
        <ul class="steps small">
          <li><b>Topic stage done</b> – each of a topic's five ticks (Learn, Revision 1, Revision 2, Interview test, Re-practice), including a Shaky or Failed test</li>
          <li><b>Study session</b> – each timer or manually logged session</li>
          <li><b>Card reviewed</b> – each flashcard you rate while reviewing</li>
          <li><b>Card created</b> – each new flashcard</li>
          <li><b>Note written</b> – each new note</li>
          <li><b>File attached</b> – each PDF or recording you upload</li>
        </ul>
        <p class="small muted">Colours: 1–2, 3–5, 6–9 and 10+ activities a day. Undoing a stage or deleting something removes its activity. Grey squares are days still to come. Hover a square to see that day's breakdown.</p>`,
      buttons: [{ label: 'Got it', kind: 'primary', primary: true, value: () => true }],
    });
  }

  const handlers = {
    'hm-page': (el) => { const s = el.dataset.scope; offsets[s] = Math.max(0, (offsets[s] || 0) + Number(el.dataset.d)); TI.store.bump(); },
    'hm-learn': () => learn(),
  };

  TI.heatmap = { render, counts, handlers };
})(window.TI);
