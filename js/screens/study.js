// Flashcard review session with Again / Hard / Good / Easy grading.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  let session = null; // { key, queue: [cardId], i, revealed, results: [] }

  function start(key) {
    const p = sel.activeProject();
    const sids = key === 'all' ? (p ? sel.subjects(p.id).map((s) => s.id) : []) : [key];
    let cards = state.cards.filter((c) => sids.includes(c.subjectId));
    let due = cards.filter((c) => TI.srs.isDue(c)).sort((a, b) => a.due - b.due);
    const ahead = !due.length;
    if (ahead) due = cards.slice().sort((a, b) => a.due - b.due).slice(0, 20);
    session = { key, queue: due.map((c) => c.id), i: 0, revealed: false, results: [], ahead, started: Date.now() };
  }

  function grade(g) {
    if (!session || !session.revealed) return;
    const id = session.queue[session.i];
    actions.reviewCard(id, g);
    session.results.push({ id, g });
    if (g === 'again') session.queue.push(id);
    session.i++; session.revealed = false;
    TI.store.bump();
  }

  const screen = {
    title: 'Study',
    hideNav: true,
    render(ctx) {
      const key = ctx.params[0] || 'all';
      if (!session || session.key !== key || ctx.query.restart) start(key);
      const subj = key === 'all' ? null : sel.subject(key);
      const color = subj ? subj.color : 'var(--primary)';
      const title = subj ? subj.name : 'All due cards';
      const total = session.queue.length; const done = session.i;
      const head = `<div class="study-head" style="--c:${color}"><button class="icon-btn" data-act="study-exit" aria-label="Close">${U.icon('close')}</button>
        <div class="grow" style="min-width:0"><div class="title-tint ellipsis" style="font-weight:600;font-size:17px">${U.esc(title)}</div><div class="tiny faint">${session.ahead ? 'Studying ahead – nothing is due' : 'Spaced repetition'}</div></div>
        <span class="tabular muted">${Math.min(done + (done < total ? 1 : 0), total)} / ${total}</span></div>
        ${TI.ui.bar(total ? done / total : 0, color, 'thin')}`;
      if (!total) return `<div class="study">${head}${TI.ui.empty('style', 'No cards to study', 'Add some cards to this deck first.', `<button class="btn primary" data-act="nav" data-to="/cards/${subj ? subj.id : ''}">Go to deck</button>`)}</div>`;
      if (done >= total) {
        const n = session.results.length; const again = session.results.filter((r) => r.g === 'again').length;
        const firstTry = new Set(); const missed = new Set(session.results.filter((r) => r.g === 'again').map((r) => r.id));
        session.results.forEach((r) => firstTry.add(r.id));
        const acc = firstTry.size ? (firstTry.size - missed.size) / firstTry.size : 0;
        const mins = Math.max(1, Math.round((Date.now() - session.started) / 60000));
        return `<div class="study">${head}<div class="study-done">
          <div class="big-emoji">🎉</div><h2>Session complete</h2><p class="muted">You reviewed ${U.plural(firstTry.size, 'card')} in about ${U.plural(mins, 'minute')}.</p>
          <div class="kpis kpis-3" style="max-width:520px;margin:18px auto">${TI.ui.kpi('style', 'Reviews', String(n), '', color)}${TI.ui.kpi('replay', 'Again', String(again), '', '#ED5B6C')}${TI.ui.kpi('target', 'First-try', U.pctInt(acc), '', '#25AE97')}</div>
          <div class="row" style="justify-content:center"><button class="btn" data-act="study-exit">Done</button><button class="btn primary" data-act="nav" data-to="/study/${key}?restart=1">Study again</button></div>
        </div></div>`;
      }
      const c = state.cards.find((x) => x.id === session.queue[session.i]);
      if (!c) { session.i++; return screen.render(ctx); }
      const cs = sel.subject(c.subjectId);
      const prev = TI.srs.preview(c);
      return `<div class="study" style="--c:${cs ? cs.color : color}">${head}
        <div class="study-card ${session.revealed ? 'revealed' : ''}" data-act="study-reveal">
          ${key === 'all' && cs ? `<div class="tiny" style="color:var(--c);margin-bottom:10px">${U.esc(cs.name)}</div>` : ''}
          <div class="study-front">${U.nl2br(U.esc(c.front))}</div>
          ${session.revealed ? `<div class="study-divider"></div><div class="study-back">${U.nl2br(U.linkify(c.back))}</div>` : '<div class="study-hint">Tap or press <kbd>Space</kbd> to show the answer</div>'}
        </div>
        ${session.revealed ? `<div class="grades">${prev.map((g) => `<button class="grade" style="--g:${g.color}" data-act="study-grade" data-g="${g.id}"><b>${g.label}</b><span>${g.label2}</span><kbd>${g.key}</kbd></button>`).join('')}</div>`
          : `<div class="grades single"><button class="btn white lg block" data-act="study-reveal">Show answer</button></div>`}
      </div>`;
    },
    actions: {
      'study-reveal': () => { if (session && !session.revealed) { session.revealed = true; TI.store.bump(); } },
      'study-grade': (el) => grade(el.dataset.g),
      'study-exit': () => { const k = session && session.key; session = null; TI.router.go(k && k !== 'all' ? `/cards/${k}` : '/cards', { replace: true }); },
    },
    keys(e) {
      if (!session) return false;
      if ((e.key === ' ' || e.key === 'Enter') && !session.revealed) { screen.actions['study-reveal'](); return true; }
      if (session.revealed && ['1', '2', '3', '4'].includes(e.key)) { grade(TI.srs.GRADES[+e.key - 1].id); return true; }
      if (e.key === 'Escape') { screen.actions['study-exit'](); return true; }
      return false;
    },
  };
  TI.screens.study = screen;
})(window.TI);
