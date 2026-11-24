// Multi-level syllabus tree (subject → units → chapters → topics …) with progress per level.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;

  function nodeRow(n, s, opts, depth) {
    const st = TI.stats;
    const kids = st.children(state, s.id, n.id);
    const parent = kids.length > 0;
    const open = parent && !!state.ui.expandedNodes[n.id];
    const r = st.nodeRatio(state, n.id);
    const t = st.nodeTime(state, n.id);
    const today = U.today();
    const late = n.due && n.due < today && r < 1;
    const dueTag = n.due && r < 1 ? `<span class="due ${late ? 'late' : ''}" title="Due ${U.fmtDay(n.due)}">${U.icon('event', 'xs')}${n.due === today ? 'Today' : late ? 'Overdue' : U.fmtDate(U.parseDay(n.due))}</span>` : '';
    const running = TI.timer.state.status !== 'idle' && TI.timer.state.nodeId === n.id;
    let html = `<div class="node ${parent ? 'parent' : ''} ${open ? 'open' : ''}" data-node="${n.id}">
      <div class="node-main">
        <div class="title-row">
          ${parent ? `<span class="ms caret" data-act="node-open" data-id="${n.id}">chevron_right</span>` : ''}
          <span class="title" ${parent ? `data-act="node-open" data-id="${n.id}"` : ''} title="${U.esc(n.title)}">${U.esc(n.title)}</span>
          <span class="row-ics">${TI.attach.iconsHtml(s.id, n.id)}</span>${dueTag}
          ${t && opts.showTime ? `<span class="node-time">${U.fmtDur(t, { short: true })}</span>` : ''}
        </div>
        ${TI.ui.barRow(r, s.color)}
      </div>
      <div class="acts">
        <button class="icon-btn sm muted menu-btn" data-act="node-menu" data-id="${n.id}" aria-label="More for ${U.esc(n.title)}">${U.icon('more_vert')}</button>
        ${parent ? unitCheck(n, r) : ticks(n)}
        ${opts.showPlay ? `<button class="play-btn small ${running ? 'running' : ''}" style="--c:${s.color}" data-act="node-play" data-id="${n.id}" aria-label="Study ${U.esc(n.title)}">${U.icon(running ? 'graphic_eq' : 'play_arrow')}</button>` : ''}
      </div>
    </div>`;
    if (open) {
      html += `<div class="tree-children">${kids.map((k) => nodeRow(k, s, opts, depth + 1)).join('')}
        <button class="btn outline sm block add-topic" style="--c:${s.color}" data-act="node-add" data-subject="${s.id}" data-parent="${n.id}">Add New Topic</button></div>`;
    }
    return html;
  }

  // Five stage ticks for a topic: filled = done, outlined = next (amber ring due today, red overdue), dim = later
  function ticks(n) {
    const ST = TI.stages; const s = ST.stageOf(n); const ds = ST.dueState(n);
    let h = '';
    for (let k = 0; k < ST.N; k++) {
      const cls = k < s ? 'done' : k === s ? `next ${ds === 'over' ? 'over' : ds === 'due' ? 'due' : ''}` : 'later';
      h += `<button class="check-btn stg ${cls}" data-act="stage-tick" data-id="${n.id}" data-k="${k}" title="${U.esc(ST.tooltip(state, n, k))}" aria-label="${U.esc(ST.tooltip(state, n, k))}">${U.icon('check')}</button>`;
    }
    return `<div class="stg-ticks">${h}</div>`;
  }
  // Units / chapters: one tick showing how far their topics are (filled when all mastered)
  function unitCheck(n, r) {
    const p = TI.stats.nodeProgress(state, n.id);
    const tip = `${p.done} of ${U.plural(p.leaves, 'topic')} mastered · ${U.pctInt(r)} of all stages`;
    return `<button class="check-btn ${p.leaves && p.done === p.leaves ? 'done' : r > 0 ? 'partial' : ''}" data-act="node-check" data-id="${n.id}" title="${U.esc(tip)}" aria-label="${U.esc(tip)}">${U.icon('check')}</button>`;
  }

  function render(subjectId, opts = {}) {
    const s = sel.subject(subjectId); if (!s) return '';
    const o = { showPlay: true, showTime: true, ...opts };
    const roots = TI.stats.children(state, s.id, null);
    const canAdd = true;
    return `<div class="tree" style="--c:${s.color}">
      ${roots.length ? roots.map((n) => nodeRow(n, s, o, 0)).join('') : `<div class="tree-empty">No units yet. Break this subject into units, chapters and topics to track progress.</div>`}
      ${canAdd ? `<button class="btn outline block add-topic" style="--c:${s.color};margin-top:12px" data-act="node-add" data-subject="${s.id}" data-parent="">${U.icon('add')}Add New Unit</button>` : ''}
    </div>`;
  }

  function nodeMenu(anchor, id) {
    const n = sel.node(id); if (!n) return;
    const s = sel.subject(n.subjectId);
    TI.ui.openMenu(anchor, [
      { icon: 'play_circle', label: 'Study this now', onClick: () => startOn(n) },
      { icon: 'subdirectory_arrow_right', label: 'Add sub-topics', onClick: () => TI.forms.topicForm(n.subjectId, n.id) },
      { icon: 'edit', label: 'Rename', onClick: async () => { const v = await TI.ui.promptDialog({ title: 'Rename', value: n.title }); if (v && v.trim()) actions.updateNode(n.id, { title: v.trim() }); } },
      ...(TI.stats.children(state, n.subjectId, n.id).length ? [] : [
        { icon: 'timeline', label: 'Stage history', onClick: () => historySheet(n) },
        ...(TI.stages.logsOf(state, n.id).length ? [{ icon: 'undo', label: `Undo last stage`, onClick: () => undo(n.id) }] : []),
        { icon: 'style', label: `Interview cards (${topicCards(n).length})`, onClick: () => TI.screens.cards.addSheet(n.subjectId, 'single', null, n.id) },
        { icon: 'auto_awesome', label: 'Generate interview questions (AI)', onClick: () => TI.aiui.questionsSheet(n.id) },
        { icon: 'record_voice_over', label: 'Mock interview (AI)', onClick: () => TI.aiui.mockInterview(n.id) },
      ]),
      { icon: 'event', label: n.due ? `Due ${U.fmtDay(n.due)} – change` : 'Set due date', onClick: () => dueDialog(n) },
      { icon: 'sticky_note_2', label: 'Add note', onClick: () => TI.screens.notes.edit(null, { subjectId: n.subjectId, nodeId: n.id, title: n.title }) },
      ...(sel.notesOn(n.subjectId, n.id).length ? [{ icon: 'notes', label: `Notes (${sel.notesOn(n.subjectId, n.id).length})`, onClick: () => TI.attach.openNotes(anchor, n.subjectId, n.id) }] : []),
      { icon: 'attach_file', label: 'Attach PDF / audio', onClick: () => TI.attach.pick(n.subjectId, n.id) },
      ...(TI.attach.countOn(n.subjectId, n.id) ? [{ icon: 'folder_open', label: `Attachments (${TI.attach.countOn(n.subjectId, n.id)})`, onClick: () => TI.attach.manage(n.subjectId, n.id) }] : []),
      { sep: true },
      { icon: 'arrow_upward', label: 'Move up', onClick: () => actions.moveNode(n.id, -1) },
      { icon: 'arrow_downward', label: 'Move down', onClick: () => actions.moveNode(n.id, 1) },
      { sep: true },
      { icon: 'delete', label: 'Delete', danger: true, onClick: async () => {
        const desc = TI.stats.descendants(state, n.id); const count = desc.length;
        const ids = new Set([n.id, ...desc.map((d) => d.id)]); const files = state.attachments.filter((a) => ids.has(a.nodeId)).length;
        const extra = files ? ` ${U.plural(files, 'attached file')} will be deleted from GitHub too.` : '';
        if (await TI.ui.confirmDialog(`Delete “${n.title}”?`, (count ? `This also deletes ${U.plural(count, 'sub-topic')}. Study time stays in ${s ? s.name : 'the subject'}.` : 'Study time stays in the subject.') + extra)) actions.deleteNode(n.id);
      } },
    ]);
  }

  async function dueDialog(n) {
    const v = await TI.ui.dialog({
      title: 'Due date', message: U.esc(n.title),
      html: `<div class="field"><input class="input" type="date" value="${n.due || U.today()}" /></div>
        <div class="chips">${[['Today', 0], ['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]].map(([l, d]) => `<button class="chip" data-d="${d}">${l}</button>`).join('')}</div>`,
      buttons: [{ label: 'Clear', kind: 'ghost', value: () => '' }, { label: 'Save', kind: 'primary', primary: true, value: (el) => el.querySelector('input').value }],
      onMount: (el) => el.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { el.querySelector('input').value = U.addDaysKey(U.today(), +b.dataset.d); })),
    });
    if (v === null || v === undefined) return;
    actions.updateNode(n.id, { due: v || null });
  }

  function startOn(n) {
    const t = TI.timer;
    if (t.isActive() && t.state.subjectId !== n.subjectId) {
      TI.ui.toast('Stop the running timer first', { icon: 'timer', action: { label: 'Open', fn: () => TI.router.go('/subject/' + t.state.subjectId) } });
      return;
    }
    t.setTarget(n.subjectId, n.id);
    if (!t.isActive()) t.start();
    TI.router.go('/subject/' + n.subjectId);
  }

  const topicCards = (n) => state.cards.filter((c) => c.nodeId === n.id);
  const nextLine = (r) => (r.toStage >= TI.stages.N ? 'Topic mastered 🎉' : `${TI.stages.NAMES[r.toStage]} due ${r.due === U.addDaysKey(U.today(), 1) ? 'tomorrow' : U.fmtDate(U.parseDay(r.due))}`);

  function afterStage(n, r) {
    const ST = TI.stages; const s = sel.subject(n.subjectId);
    let msg;
    if (r.result === 'shaky') msg = `Interview test again in ${ST.SHAKY_DAYS} days`;
    else if (r.result === 'fail') msg = `Back to Revision 2 · due tomorrow`;
    else msg = `${ST.NAMES[r.stage - 1]} done · ${nextLine(r)}`;
    TI.ui.toast(msg, { icon: r.toStage >= ST.N ? 'military_tech' : 'check_circle', duration: 4500, action: { label: 'Undo', fn: () => undo(n.id) } });
    // Revision 2 done → the interview test is next: prepare its questions in the background
    if (r.toStage === 3 && !r.result) TI.ai.autoFill(n.id);
    if (r.toStage >= ST.N && s && TI.stats.subjectProgress(state, s.id).done === TI.stats.subjectProgress(state, s.id).leaves) setTimeout(() => TI.ui.toast(`🎉 ${s.name}: every topic mastered!`, { icon: 'celebration', duration: 4500 }), 900);
  }

  async function earlyOk(n) {
    const ST = TI.stages; const s = ST.stageOf(n);
    if (!ST.isEarly(n)) return { ok: true, early: false };
    const name = ST.NAMES[s];
    const why = s === 1 ? 'Revising too soon makes the next recall weaker.' : s === 4 ? 'Doing it now gives you less time to forget and re-learn.' : 'Spacing the stages out is what makes the topic stick.';
    const ok = await TI.ui.confirmDialog(`Mark ${name} done early?`, `${name} is due ${ST.when(n.stageDue)}. ${why}`, 'Mark done anyway', 'primary');
    return { ok, early: true };
  }

  async function tick(id, k) {
    const n = sel.node(id); if (!n) return;
    const ST = TI.stages; const s = ST.stageOf(n);
    if (k > s) { TI.ui.toast(`Finish ${ST.NAMES[s]} first`, { icon: 'info' }); return; }
    if (k < s) {
      if (k !== s - 1) { TI.ui.toast('Undo works one stage at a time, from the last one', { icon: 'info' }); return; }
      if (await TI.ui.confirmDialog(`Undo ${ST.NAMES[k]}?`, `“${n.title}” goes back to ${ST.NAMES[k]}.`, 'Undo', 'primary')) undo(id);
      return;
    }
    if (s === 3) { testSheet(n); return; }
    const e = await earlyOk(n); if (!e.ok) return;
    const r = actions.completeStage(id, { early: e.early });
    if (r) afterStage(n, r);
  }

  function undo(id) {
    const n = sel.node(id); const last = actions.undoStage(id);
    if (!last || !n) return;
    TI.ui.toast(`Undone · ${n.title} is back at ${TI.stages.NAMES[TI.stages.stageOf(n)] || 'Learn'}`, { icon: 'undo' });
  }

  // Interview test: practise this topic's flashcards, then record Pass / Shaky / Fail
  function testSheet(n) {
    const ST = TI.stages; const cards = topicCards(n); const early = ST.isEarly(n);
    TI.ui.openSheet({
      title: `Interview test · ${n.title}`,
      html: `${early ? `<div class="cx-err" style="margin-bottom:12px">${U.icon('warning')}<span>The interview test is due ${U.esc(ST.when(n.stageDue))}. Testing early gives you less time to forget, so it tells you less.</span></div>` : ''}
        <p class="muted" style="margin-top:0">Test yourself one of these ways, or record the result of a test you did elsewhere.</p>
        <div class="test-ways">
          <button class="test-way ai" data-act="mock">${U.icon('record_voice_over')}<b>Mock interview with AI</b><span>Asks questions and follow-ups, scores you and suggests the result</span></button>
          ${cards.length ? `<button class="test-way" data-act="start">${U.icon('style')}<b>Flashcard test</b><span>Answer the topic's ${U.plural(cards.length, 'card')} out loud and check yourself</span></button>`
            : `<button class="test-way" data-act="gen">${U.icon('auto_awesome')}<b>Generate questions with AI</b><span>Creates this topic's interview cards with model answers</span></button>`}
        </div>
        <div class="row" style="gap:12px;flex-wrap:wrap;margin-top:8px">
          ${cards.length ? `<button class="btn sm ghost" data-act="gen">${U.icon('auto_awesome')}More questions with AI</button>` : ''}
          <button class="btn sm ghost" data-act="cards">${U.icon('add')}${cards.length ? 'Add cards yourself' : 'Write cards yourself'}</button>
        </div>
        <div class="small muted" style="margin:18px 0 8px">Record the result</div>
        <div class="test-res">
          <button class="test-opt pass" data-act="res" data-r="pass">${U.icon('verified')}<b>Pass</b><span>Re-practice in ${ST.GAP[3]} days</span></button>
          <button class="test-opt shaky" data-act="res" data-r="shaky">${U.icon('help')}<b>Shaky</b><span>Test again in ${ST.SHAKY_DAYS} days</span></button>
          <button class="test-opt fail" data-act="res" data-r="fail">${U.icon('replay')}<b>Fail</b><span>Back to Revision 2</span></button>
        </div>`,
      footer: '<button class="btn ghost" data-close>Close</button>',
      onMount(a) {
        TI.forms.onAct(a, {
          start() { a.close(); TI.router.go(`/study/${n.subjectId}?topic=${n.id}&test=1`); },
          cards() { a.close(); TI.screens.cards.addSheet(n.subjectId, 'single', null, n.id); },
          mock() { a.close(); TI.aiui.mockInterview(n.id); },
          gen() { a.close(); TI.aiui.questionsSheet(n.id, { then: () => testSheet(sel.node(n.id)) }); },
          res(el) { a.close(); recordTest(n.id, el.dataset.r, early); },
        });
      },
    });
  }
  function recordTest(id, result, early = TI.stages.isEarly(sel.node(id) || {})) {
    const n = sel.node(id); if (!n || TI.stages.stageOf(n) !== 3) return;
    const r = actions.completeStage(id, { result, early });
    if (r) afterStage(n, r);
  }

  function historySheet(n) {
    const ST = TI.stages; const logs = ST.logsOf(state, n.id); const s = ST.stageOf(n);
    const rows = logs.map((l) => {
      const label = l.stage === 4 && l.result ? `Interview test · ${l.result}` : ST.NAMES[l.stage - 1];
      const ic = l.result === 'fail' ? 'replay' : l.result === 'shaky' ? 'help' : 'check_circle';
      return `<div class="list-item"><span class="lead" style="--c:${l.result === 'fail' ? 'var(--danger)' : l.result === 'shaky' ? 'var(--warning)' : 'var(--success)'}">${U.icon(ic)}</span><div class="txt"><div class="ttl">${U.esc(label)}${l.early ? ' <span class="small muted">(early)</span>' : ''}${l.migrated ? ' <span class="small muted">(from the old tick)</span>' : ''}</div><div class="sub">${U.esc(U.fmtDay(U.dayKey(l.at)))} · ${U.esc(U.fmtTime ? U.fmtTime(l.at) : '')}</div></div></div>`;
    }).join('');
    const next = s >= ST.N ? `${U.icon('military_tech')} Mastered` : s === 0 ? `Next: ${ST.NAMES[0]}` : `Next: ${ST.NAMES[s]} · ${n.stageDue ? (ST.dueState(n) === 'over' ? 'overdue since ' : 'due ') + U.fmtDay(n.stageDue) : ''}`;
    TI.ui.openSheet({
      title: `Stage history · ${n.title}`,
      html: `<div class="row" style="gap:10px;margin-bottom:12px">${ticks(n).replace(/data-act="stage-tick"/g, 'tabindex="-1"')}<span class="muted">${U.pctInt(s / ST.N)}</span></div>
        <div class="small muted" style="margin-bottom:10px">${next}</div>
        ${rows || '<div class="muted">No stages done yet.</div>'}`,
      footer: `${logs.length ? '<button class="btn ghost danger" data-act="undo">Undo last stage</button>' : ''}<button class="btn" data-close>Close</button>`,
      onMount(a) { TI.forms.onAct(a, { undo() { a.close(); undo(n.id); } }); },
    });
  }

  // Units / chapters: Learn-done for all their not-started topics
  async function check(id) {
    const n = sel.node(id); if (!n) return;
    const todo = TI.stats.descendants(state, id).filter((d) => !TI.stats.children(state, d.subjectId, d.id).length && TI.stages.stageOf(d) === 0).length;
    if (!todo) { TI.ui.toast('Every topic here has started. Tick the stages topic by topic.', { icon: 'info' }); return; }
    if (!(await TI.ui.confirmDialog(`Mark Learn done for ${U.plural(todo, 'topic')}?`, `All not-started topics in “${n.title}” get stage 1 (Learn) done today. Revision 1 is then due tomorrow.`, 'Mark Learn done', 'primary'))) return;
    const c = actions.learnAll(id);
    TI.ui.toast(`Learn done for ${U.plural(c, 'topic')} · Revision 1 due tomorrow`, { icon: 'check_circle' });
  }

  // Global click actions (wired in main.js)
  const handlers = {
    'node-open': (el) => actions.toggleUiFlag('expandedNodes', el.dataset.id),
    'node-check': (el) => check(el.dataset.id),
    'stage-tick': (el) => tick(el.dataset.id, +el.dataset.k),
    'node-menu': (el) => nodeMenu(el, el.dataset.id),
    'node-play': (el) => { const n = sel.node(el.dataset.id); if (n) startOn(n); },
    'node-add': (el) => TI.forms.topicForm(el.dataset.subject, el.dataset.parent || null),
  };

  TI.tree = { render, handlers, startOn, ticks, testSheet, recordTest, historySheet, undo };
})(window.TI);
