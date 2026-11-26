// Stage quiz: Learn, Revision 1 and Revision 2 only turn green after ≥ 80% on the topic's own questions.
// Route: #/quiz/<nodeId>[?early=1]
(function (TI) {
  TI.screens = TI.screens || {};
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const Q = TI.quiz; const ST = TI.stages;
  let sess = null;
  const rerender = () => TI.app.render(true);
  const L = (i) => String.fromCharCode(65 + i);

  function start(n, early) {
    const k = ST.stageOf(n) + 1;
    sess = { nodeId: n.id, stage: k, early, qs: Q.pick(state, n, Q.sizeFor(state, n)), i: 0, chosen: [], phase: 'intro', attempt: null, result: null };
  }

  function finish() {
    const n = sel.node(sess.nodeId); if (!n) return;
    const answers = sess.qs.map((q, i) => ({ id: q.id, chosen: sess.chosen[i], ok: sess.chosen[i] === q.correct }));
    const score = answers.filter((a) => a.ok).length; const total = sess.qs.length;
    const passed = score >= Q.passMark(total);
    const att = actions.recordQuiz({ nodeId: n.id, stage: sess.stage, score, total, passed, answers: answers.map((a, i) => ({ id: a.id, pick: a.chosen == null ? '' : sess.qs[i].options[a.chosen], ok: a.ok })) });
    sess.attempt = att; sess.phase = 'result';
    if (passed && ST.stageOf(n) + 1 === sess.stage) sess.result = actions.completeStage(n.id, { early: sess.early, quiz: att });
    rerender();
  }

  function resultHtml(n) {
    const a = sess.attempt; const pct = Math.round((a.score / a.total) * 100); const need = Q.passMark(a.total);
    const name = ST.NAMES[sess.stage - 1];
    let next = '';
    if (a.passed && sess.result) {
      const r = sess.result;
      next = r.toStage >= ST.N ? 'Topic mastered' : `${name} done · ${ST.NAMES[r.toStage]} due ${ST.when(r.due)}`;
    }
    const retry = a.at + Q.RETRY_HOURS * 3600000;
    const rows = sess.qs.map((q, i) => {
      const ch = sess.chosen[i]; const ok = ch === q.correct;
      return `<div class="qz-rev ${ok ? 'ok' : 'bad'}"><div class="qz-rev-h">${U.icon(ok ? 'check_circle' : 'cancel')}<b>${i + 1}. ${U.esc(q.q)}</b></div>
        ${ok ? `<div class="qz-ans ok">${L(ch)}) ${U.esc(q.options[ch])}</div>` : `${ch != null ? `<div class="qz-ans bad">Your answer: ${L(ch)}) ${U.esc(q.options[ch])}</div>` : '<div class="qz-ans bad">Not answered</div>'}<div class="qz-ans ok">Right answer: ${L(q.correct)}) ${U.esc(q.options[q.correct])}</div>`}
        ${q.why ? `<div class="qz-why">${U.esc(q.why)}</div>` : ''}</div>`;
    }).join('');
    return `<div class="qz-wrap">
      <div class="qz-result ${a.passed ? 'pass' : 'fail'}">
        <div class="qz-big">${U.icon(a.passed ? 'check_circle' : 'cancel', 'fill')}</div>
        <h2>${a.score}/${a.total} · ${pct}%</h2>
        <div class="qz-verdict">${a.passed ? `Passed – ${U.esc(name)} is done` : `Not yet – ${need}/${a.total} (80%) needed`}</div>
        <p class="muted">${a.passed ? U.esc(next) : `Review the answers below, revise the topic, and try again after ${U.esc(U.fmtTime(retry))}${U.dayKey(retry) !== U.today() ? ' tomorrow' : ''}.`}</p>
      </div>
      <h4 class="iv-qh">Review</h4>${rows}
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:18px;justify-content:center">
        <button class="btn primary" data-act="qz-close">Done</button>
        <button class="btn ghost" data-act="qz-bank">${U.icon('quiz')}Edit questions</button>
      </div></div>`;
  }

  const screen = {
    title: 'Quiz', fullscreen: true, static: true,
    render(ctx) {
      const n = sel.node(ctx.params[0]);
      const bar = (title, sub) => `<div class="iv-bar"><button class="icon-btn" data-act="qz-close" aria-label="Close">${U.icon('close')}</button><div class="grow" style="min-width:0"><div class="ellipsis iv-title">${title}</div><div class="ellipsis tiny faint">${sub}</div></div></div>`;
      if (!n) return `<div class="iv">${bar('Quiz', '')}${TI.ui.empty('search_off', 'Topic not found', 'It may have been deleted, or this device has not synced yet.')}</div>`;
      if (!sess || sess.nodeId !== n.id) start(n, !!ctx.query.early);
      const s = sel.subject(n.subjectId); const name = ST.NAMES[sess.stage - 1] || 'Quiz';
      const path = TI.stats.pathOf(state, n.id).map((x) => x.title).join(' › ');
      const total = sess.qs.length;
      let body;
      if (sess.phase === 'result') body = resultHtml(n);
      else if (sess.stage > Q.QUIZ_STAGES || total === 0) body = TI.ui.empty('quiz', 'No quiz for this stage', sess.stage > Q.QUIZ_STAGES ? 'Quizzes are for Learn, Revision 1 and Revision 2.' : 'This topic has no quiz questions yet.', `<button class="btn primary" data-act="qz-bank">Add questions</button>`);
      else if (sess.phase === 'intro') {
        body = `<div class="iv-intro card"><div class="iv-ic">${U.icon('quiz')}</div><h2>${U.esc(name)} quiz · ${U.esc(n.title)}</h2>
          <p class="muted">${U.plural(total, 'question')} from this topic. Score <b>${Q.passMark(total)}/${total} (80%)</b> or more to complete ${U.esc(name)}. Answers are shown at the end.</p>
          ${sess.early ? `<p class="small" style="color:var(--warning)">${U.icon('warning', 'xs')} ${U.esc(name)} is due ${U.esc(ST.when(n.stageDue))} – you chose to do it early.</p>` : ''}
          <button class="btn primary lg" data-act="qz-start">${U.icon('play_arrow')}Start quiz</button>
          <p class="tiny faint" style="margin-top:14px">Keys: A–F or 1–6 to choose · Enter for next</p></div>`;
      } else {
        const q = sess.qs[sess.i]; const ch = sess.chosen[sess.i];
        body = `<div class="qz-wrap">
          <div class="qz-prog"><i style="width:${(sess.i / total) * 100}%"></i></div>
          <div class="qz-q">${U.esc(q.q).replace(/\n/g, '<br>')}</div>
          <div class="qz-opts">${q.options.map((o, i) => `<button class="qz-opt ${ch === i ? 'on' : ''}" data-act="qz-pick" data-i="${i}"><span class="qz-l">${L(i)}</span><span>${U.esc(o)}</span></button>`).join('')}</div>
          <div class="row" style="gap:8px;margin-top:18px">
            <button class="btn ghost" data-act="qz-prev" ${sess.i ? '' : 'disabled'}>${U.icon('arrow_back')}Previous</button>
            <div class="grow"></div>
            <button class="btn primary" data-act="qz-next" ${ch == null ? 'disabled' : ''}>${sess.i === total - 1 ? `${U.icon('flag')}Finish` : `Next${U.icon('arrow_forward')}`}</button>
          </div></div>`;
      }
      const prog = sess.phase === 'q' ? `Question ${sess.i + 1} of ${total}` : sess.phase === 'result' ? 'Result' : `${total} questions · 80% to pass`;
      return `<div class="iv qz" style="--c:${s ? s.color : 'var(--primary)'}">${bar(`${U.esc(name)} quiz · ${U.esc(n.title)}`, `${U.esc(path)} · ${prog}`)}<div class="iv-body">${body}</div></div>`;
    },
    keys(e) {
      if (!sess || sess.phase !== 'q') return false;
      const q = sess.qs[sess.i]; const k = e.key.toUpperCase();
      let idx = /^[1-6]$/.test(k) ? +k - 1 : /^[A-F]$/.test(k) ? k.charCodeAt(0) - 65 : -1;
      if (idx >= 0 && idx < q.options.length) { sess.chosen[sess.i] = idx; rerender(); return true; }
      if (e.key === 'Enter' && sess.chosen[sess.i] != null) { screen.actions['qz-next'](); return true; }
      if (e.key === 'ArrowLeft' && sess.i) { screen.actions['qz-prev'](); return true; }
      return false;
    },
    actions: {
      'qz-start': () => { sess.phase = 'q'; rerender(); },
      'qz-pick': (el) => { sess.chosen[sess.i] = +el.dataset.i; rerender(); },
      'qz-prev': () => { if (sess.i) { sess.i--; rerender(); } },
      'qz-next': () => { if (sess.chosen[sess.i] == null) return; if (sess.i < sess.qs.length - 1) { sess.i++; rerender(); } else finish(); },
      'qz-bank': () => { const id = sess && sess.nodeId; if (id) TI.mcq.bankSheet(id); },
      'qz-close': () => {
        const n = sess && sel.node(sess.nodeId);
        const go = () => { sess = null; TI.router.go(n ? `/subject/${n.subjectId}` : '/project', { replace: true }); };
        if (sess && sess.phase === 'q' && sess.chosen.some((x) => x != null)) TI.ui.confirmDialog('Leave the quiz?', 'Your answers so far are not saved and this attempt does not count.', 'Leave').then((ok) => ok && go());
        else go();
      },
    },
  };
  TI.screens.quiz = screen;
})(window.TI);
