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
    const hasNote = state.notes.some((m) => m.nodeId === n.id);
    const running = TI.timer.state.status !== 'idle' && TI.timer.state.nodeId === n.id;
    let html = `<div class="node ${parent ? 'parent' : ''} ${open ? 'open' : ''}" data-node="${n.id}">
      <div class="node-main">
        <div class="title-row">
          ${parent ? `<span class="ms caret" data-act="node-open" data-id="${n.id}">chevron_right</span>` : ''}
          <span class="title" ${parent ? `data-act="node-open" data-id="${n.id}"` : ''} title="${U.esc(n.title)}">${U.esc(n.title)}</span>
          ${hasNote ? U.icon('sticky_note_2', 'note-ic') : ''}${dueTag}
          ${t && opts.showTime ? `<span class="node-time">${U.fmtDur(t, { short: true })}</span>` : ''}
        </div>
        ${TI.ui.barRow(r, s.color)}
      </div>
      <div class="acts">
        <button class="icon-btn sm muted menu-btn" data-act="node-menu" data-id="${n.id}" aria-label="More for ${U.esc(n.title)}">${U.icon('more_vert')}</button>
        <button class="check-btn ${r >= 1 ? 'done' : r > 0 ? 'partial' : ''}" data-act="node-check" data-id="${n.id}" aria-label="${r >= 1 ? 'Mark not done' : 'Mark done'}" aria-pressed="${r >= 1}">${U.icon('check')}</button>
        ${opts.showPlay ? `<button class="play-btn small ${running ? 'running' : ''}" style="--c:${s.color}" data-act="node-play" data-id="${n.id}" aria-label="Study ${U.esc(n.title)}">${U.icon(running ? 'graphic_eq' : 'play_arrow')}</button>` : ''}
      </div>
    </div>`;
    if (open) {
      html += `<div class="tree-children">${kids.map((k) => nodeRow(k, s, opts, depth + 1)).join('')}
        <button class="btn outline sm block add-topic" style="--c:${s.color}" data-act="node-add" data-subject="${s.id}" data-parent="${n.id}">Add New Topic</button></div>`;
    }
    return html;
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
      { icon: 'event', label: n.due ? `Due ${U.fmtDay(n.due)} – change` : 'Set due date', onClick: () => dueDialog(n) },
      { icon: 'sticky_note_2', label: 'Add note', onClick: () => TI.screens.notes.edit(null, { subjectId: n.subjectId, nodeId: n.id, title: n.title }) },
      { sep: true },
      { icon: 'arrow_upward', label: 'Move up', onClick: () => actions.moveNode(n.id, -1) },
      { icon: 'arrow_downward', label: 'Move down', onClick: () => actions.moveNode(n.id, 1) },
      { sep: true },
      { icon: 'delete', label: 'Delete', danger: true, onClick: async () => {
        const count = TI.stats.descendants(state, n.id).length;
        if (await TI.ui.confirmDialog(`Delete “${n.title}”?`, count ? `This also deletes ${U.plural(count, 'sub-topic')}. Study time stays in ${s ? s.name : 'the subject'}.` : 'Study time stays in the subject.')) actions.deleteNode(n.id);
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

  function check(id) {
    const n = sel.node(id); if (!n) return;
    const nowDone = actions.toggleNode(id);
    const s = sel.subject(n.subjectId);
    if (nowDone && s && TI.stats.subjectRatio(state, s.id) >= 1) TI.ui.toast(`🎉 ${s.name} is 100% complete!`, { icon: 'celebration', duration: 4500 });
  }

  // Global click actions (wired in main.js)
  const handlers = {
    'node-open': (el) => actions.toggleUiFlag('expandedNodes', el.dataset.id),
    'node-check': (el) => check(el.dataset.id),
    'node-menu': (el) => nodeMenu(el, el.dataset.id),
    'node-play': (el) => { const n = sel.node(el.dataset.id); if (n) startOn(n); },
    'node-add': (el) => TI.forms.topicForm(el.dataset.subject, el.dataset.parent || null),
  };

  TI.tree = { render, handlers, startOn };
})(window.TI);
