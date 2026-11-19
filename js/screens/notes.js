// Notes: masonry grid per subject (tinted with the subject colour), linked to topics.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;

  function noteCard(n) {
    const s = sel.subject(n.subjectId); const node = n.nodeId ? sel.node(n.nodeId) : null;
    const big = n.title && !n.body;
    return `<article class="note-card" style="--c:${s ? s.color : '#888'}" data-act="note-open" data-id="${n.id}" tabindex="0">
      ${n.pinned ? `<span class="note-pin">${U.icon('push_pin', 'fill xs')}</span>` : ''}
      ${n.title ? `<h3 class="${big ? 'big' : ''}">${U.esc(n.title)}</h3>` : ''}
      ${n.body ? `<div class="note-body">${U.nl2br(U.linkify(U.truncate(n.body, 600)))}</div>` : ''}
      <div class="note-topic">${U.icon(node ? 'subdirectory_arrow_right' : 'menu_book', 'xs')}<span>${U.esc([s ? s.name : '', ...(node ? TI.stats.pathOf(state, node.id).map((x) => x.title) : [])].filter(Boolean).join(' › '))}${node ? '' : ' · subject note'}</span></div>
      <div class="note-date">${U.fmtDate(n.updatedAt, { year: true })}</div>
    </article>`;
  }

  function edit(id, preset = {}) {
    const existing = id ? state.notes.find((n) => n.id === id) : null;
    const p = sel.activeProject();
    const anchorSubject = existing ? sel.subject(existing.subjectId) : preset.subjectId ? sel.subject(preset.subjectId) : null;
    const subjects = anchorSubject ? sel.subjects(anchorSubject.projectId) : p ? sel.subjects(p.id) : [];
    if (!subjects.length) return TI.ui.toast('Add a subject first', { icon: 'info' });
    let sid = existing ? existing.subjectId : preset.subjectId || subjects[0].id;
    let pinned = existing ? existing.pinned : false;
    // Every level of the syllabus (units, chapters, topics), indented
    const topicOptions = (subjectId, cur) => {
      const rows = ['<option value="">Whole subject (subject note)</option>'];
      const walk = (pid, depth) => TI.stats.children(state, subjectId, pid).forEach((n) => {
        rows.push(`<option value="${n.id}" ${n.id === cur ? 'selected' : ''}>${'\u00a0\u00a0\u00a0'.repeat(depth)}${depth ? '› ' : ''}${U.esc(n.title)}</option>`);
        walk(n.id, depth + 1);
      });
      walk(null, 0); return rows.join('');
    };
    const nodeId = existing ? existing.nodeId : preset.nodeId || null;
    TI.ui.openSheet({
      title: existing ? 'Edit note' : 'New note', size: 'lg',
      html: `<input class="input note-title-input" id="n-title" placeholder="Title" value="${U.esc(existing ? existing.title : preset.title || '')}" maxlength="120" />
        <textarea class="textarea note-body-input" id="n-body" rows="12" placeholder="Write your note… Links become clickable." ${existing || preset.title ? 'autofocus' : ''}>${U.esc(existing ? existing.body : '')}</textarea>
        <div class="field-row" style="margin-top:14px"><div class="field"><label>Subject</label><select class="select" id="n-subject">${subjects.map((s) => `<option value="${s.id}" ${s.id === sid ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Topic</label><select class="select" id="n-topic">${topicOptions(sid, nodeId)}</select></div></div>
        ${existing ? `<div class="small faint">Created ${U.fmtDate(existing.createdAt, { year: true })} · edited ${U.timeAgo(existing.updatedAt)}</div>` : ''}`,
      footer: `${existing ? `<button class="btn danger" data-act="del" style="margin-right:auto">${U.icon('delete')}Delete</button>` : ''}<button class="btn ghost" data-act="pin">${U.icon('push_pin', pinned ? 'fill' : '')}<span>${pinned ? 'Pinned' : 'Pin'}</span></button><button class="btn primary" data-act="save">Save</button>`,
      onMount(a) {
        const $ = (q) => a.el.querySelector(q);
        if (!existing && !preset.title) setTimeout(() => $('#n-title').focus(), 50);
        $('#n-subject').addEventListener('change', (e) => { sid = e.target.value; $('#n-topic').innerHTML = topicOptions(sid, null); });
        a.el.addEventListener('keydown', (e) => { if (e.key === 's' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('[data-act="save"]').click(); } });
        TI.forms.onAct(a, {
          pin(t) { pinned = !pinned; t.innerHTML = `${U.icon('push_pin', pinned ? 'fill' : '')}<span>${pinned ? 'Pinned' : 'Pin'}</span>`; },
          async del() { if (await TI.ui.confirmDialog('Delete this note?', existing.title || 'This note will be removed.')) { actions.deleteNote(existing.id); a.close(); } },
          save() {
            const title = $('#n-title').value.trim(); const body = $('#n-body').value.replace(/\s+$/, '');
            if (!title && !body) { a.close(); return; }
            const data = { title, body, subjectId: sid, nodeId: $('#n-topic').value || null, pinned };
            if (existing) actions.updateNote(existing.id, data); else actions.addNote(data);
            a.close();
          },
        });
      },
    });
  }

  const screen = {
    title: 'Notes',
    render(ctx) {
      const p = sel.activeProject();
      if (!p) return TI.ui.empty('sticky_note_2', 'No project yet', 'Create an exam or project first.');
      const subjects = sel.subjects(p.id);
      const one = ctx.params[0] ? sel.subject(ctx.params[0]) : null;
      const filter = one ? one.id : state.ui.notesFilter && subjects.some((s) => s.id === state.ui.notesFilter) ? state.ui.notesFilter : 'all';
      const q = (state.ui.notesQuery || '').toLowerCase();
      let list = state.notes.filter((n) => subjects.some((s) => s.id === n.subjectId));
      if (filter !== 'all') list = list.filter((n) => n.subjectId === filter);
      // Topic filter (from a topic's note icon, or the Topic menu): node id, 'general' or ''
      const topic = filter !== 'all' ? (ctx.query.node || '') : '';
      if (topic === 'general') list = list.filter((n) => !n.nodeId);
      else if (topic) list = list.filter((n) => n.nodeId === topic);
      let topicSelect = '';
      if (filter !== 'all') {
        const counts = new Map(); state.notes.filter((n) => n.subjectId === filter).forEach((n) => counts.set(n.nodeId || 'general', (counts.get(n.nodeId || 'general') || 0) + 1));
        const opts = [...counts.entries()].filter(([k]) => k !== 'general' && sel.node(k)).map(([k, c]) => ({ k, c, label: TI.stats.pathOf(state, k).map((x) => x.title).join(' › ') })).sort((a, b) => a.label.localeCompare(b.label));
        topicSelect = `<select class="select notes-topic" data-change="notes-topic" aria-label="Topic"><option value="">All topics</option>${counts.get('general') ? `<option value="general" ${topic === 'general' ? 'selected' : ''}>Subject notes (${counts.get('general')})</option>` : ''}${opts.map((o) => `<option value="${o.k}" ${topic === o.k ? 'selected' : ''}>${U.esc(o.label)} (${o.c})</option>`).join('')}${topic && topic !== 'general' && !counts.has(topic) && sel.node(topic) ? `<option value="${topic}" selected>${U.esc(sel.node(topic).title)} (0)</option>` : ''}</select>`;
      }
      if (q) list = list.filter((n) => (n.title + ' ' + n.body).toLowerCase().includes(q));
      list.sort((a, b) => (b.pinned - a.pinned) || b.updatedAt - a.updatedAt);
      const head = one
        ? `<div class="topbar" style="--c:${one.color}"><button class="icon-btn" data-act="back" aria-label="Back">${U.icon('arrow_back')}</button><h1 class="title-tint grow ellipsis">${U.esc(one.name)}</h1></div>`
        : `<div class="page-head"><div><h1>Notes</h1><div class="sub">${U.esc(p.name)} · ${U.plural(list.length, 'note')}</div></div></div>`;
      return `${head}
        <div class="notes-tools">
          <div class="input-icon grow">${U.icon('search')}<input class="input" placeholder="Search notes" value="${U.esc(state.ui.notesQuery || '')}" data-input="notes-search" /></div>
          ${topicSelect}
          ${one ? '' : `<div class="chips">${[{ id: 'all', name: 'All', color: 'var(--primary)' }, ...subjects].map((s) => `<button class="chip ${filter === s.id ? 'on' : ''}" style="--c:${s.color}" data-act="notes-filter" data-id="${s.id}">${s.id !== 'all' ? '<span class="dot"></span>' : ''}${U.esc(s.name)}</button>`).join('')}</div>`}
        </div>
        ${list.length ? `<div class="masonry">${list.map(noteCard).join('')}</div>` : TI.ui.empty('sticky_note_2', q ? 'No matching notes' : 'No notes yet', q ? 'Try a different search.' : 'Keep formulas, mnemonics, doubts and links next to your syllabus.', q ? '' : `<button class="btn primary" data-act="note-new" data-subject="${one ? one.id : ''}">${U.icon('add')}New note</button>`)}
        <button class="fab" data-act="note-new" data-subject="${one ? one.id : filter !== 'all' ? filter : ''}" data-node="${topic && topic !== 'general' ? topic : ''}">${U.icon('add')}New note</button>`;
    },
    actions: {
      'notes-filter': (el) => { actions.setUi({ notesFilter: el.dataset.id }); if (TI.router.current.query.node) TI.router.go('/notes', { replace: true }); },
      'note-new': (el) => edit(null, { subjectId: el.dataset.subject || undefined, nodeId: el.dataset.node || null }),
    },
    changes: {
      'notes-topic': (el) => {
        const r = TI.router.current; const sid = r.params[0] || state.ui.notesFilter;
        TI.router.go(`/notes${r.params[0] ? '/' + sid : ''}${el.value ? `?node=${el.value}` : ''}`, { replace: true });
      },
    },
    inputs: { 'notes-search': (el) => actions.setUi({ notesQuery: el.value }) },
    edit,
  };
  TI.screens.notes = screen;
})(window.TI);
