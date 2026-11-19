// Shared sheets: project / subject / topic forms, manual time logging, pickers, day details, calendar.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const ui = () => TI.ui;

  function onAct(api, handlers) {
    api.el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]'); if (!t || !api.el.contains(t)) return;
      const h = handlers[t.dataset.act]; if (h) { e.preventDefault(); h(t, e); }
    });
  }

  // ---------- Project ----------
  function projectForm(project = null) {
    if (!project && !sel.canAddProject()) return TI.screens.pro.open('projects');
    let color = project ? project.color : TI.config.palette[0];
    let cat = project ? project.category : 'exam';
    const cats = TI.config.projectCategories;
    const api = ui().openSheet({
      title: project ? 'Edit exam / project' : 'New exam / project',
      html: `<div class="field"><label>Name</label><input class="input" id="pf-name" maxlength="60" value="${U.esc(project ? project.name : '')}" placeholder="e.g. SSC CGL 2027, React course" autofocus /></div>
        <div class="field"><label>Type</label><div class="chips" id="pf-cats">${cats.map((c) => `<button class="chip ${c.id === cat ? 'on' : ''}" data-act="cat" data-v="${c.id}">${U.icon(c.icon, 'sm')}${c.label}</button>`).join('')}</div></div>
        <div class="field"><label>Colour</label><div id="pf-colors">${ui().colorPicker(color)}</div></div>
        ${project ? '' : `<div class="card" style="background:var(--surface-2);margin-top:6px"><div class="row"><span class="ms" style="color:var(--primary-2)">auto_awesome</span><div class="grow small">Want the syllabus filled in? <b>Pick from 1000+ templates</b> or paste one from ChatGPT.</div><button class="btn sm outline" data-act="templates">Browse</button></div></div>`}`,
      footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-act="save">${project ? 'Save' : 'Create'}</button>`,
      onMount(a) {
        onAct(a, {
          cat(t) { cat = t.dataset.v; a.el.querySelectorAll('#pf-cats .chip').forEach((c) => c.classList.toggle('on', c.dataset.v === cat)); },
          'pick-color'(t) { color = t.dataset.color; a.el.querySelector('#pf-colors').innerHTML = ui().colorPicker(color); },
          templates() { a.close(); TI.router.go('/templates'); },
          save() {
            const name = a.el.querySelector('#pf-name').value.trim();
            if (!name) { a.el.querySelector('#pf-name').focus(); return; }
            if (project) { actions.updateProject(project.id, { name, category: cat, color }); ui().toast('Saved', { icon: 'check' }); } else {
              const p = actions.addProject({ name, category: cat, color });
              actions.setActiveProject(p.id);
              TI.router.go('/project');
              ui().toast(`${name} created – add your first subject`, { icon: 'check_circle' });
            }
            a.close();
          },
        });
        a.el.querySelector('#pf-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') a.el.querySelector('[data-act="save"]').click(); });
      },
    });
    return api;
  }

  // ---------- Subject ----------
  function subjectForm(subject = null, projectId = null) {
    const pid = subject ? subject.projectId : projectId || (sel.activeProject() || {}).id;
    if (!pid) return projectForm();
    if (!subject && !sel.canAddSubject(pid)) return TI.screens.pro.open('subjects');
    const used = new Set(sel.subjects(pid).map((s) => s.color));
    let color = subject ? subject.color : TI.config.palette.find((c) => !used.has(c)) || TI.config.palette[0];
    ui().openSheet({
      title: subject ? 'Edit subject' : 'Add new subject',
      html: `<div class="field"><label>Subject name</label><input class="input" id="sf-name" maxlength="80" value="${U.esc(subject ? subject.name : '')}" placeholder="e.g. Quantitative Aptitude" autofocus /></div>
        <div class="field"><label>Colour</label><div id="sf-colors">${ui().colorPicker(color)}</div></div>
        ${subject ? '' : `<div class="field"><label>Units & topics <span class="faint">(optional)</span></label>
          <textarea class="textarea mono" id="sf-topics" rows="6" placeholder="One per line. Indent with 2 spaces for sub-topics:\nNumber System\n  HCF and LCM\n  Surds and Indices\nAlgebra"></textarea>
          <div class="hint">Tip: paste an outline from ChatGPT or Gemini – bullets, numbers and indentation are understood.</div></div>`}`,
      footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-act="save">${subject ? 'Save' : 'Add subject'}</button>`,
      onMount(a) {
        onAct(a, {
          'pick-color'(t) { color = t.dataset.color; a.el.querySelector('#sf-colors').innerHTML = ui().colorPicker(color); },
          save() {
            const name = a.el.querySelector('#sf-name').value.trim();
            if (!name) { a.el.querySelector('#sf-name').focus(); return; }
            if (subject) actions.updateSubject(subject.id, { name, color });
            else {
              const s = actions.addSubject({ projectId: pid, name, color });
              const txt = a.el.querySelector('#sf-topics').value;
              if (s && txt.trim()) actions.addNodes(s.id, null, TI.outline.parse(txt));
              if (s) actions.setUi({ expandedSubjects: { ...state.ui.expandedSubjects, [s.id]: 1 } });
              ui().toast(`${name} added`, { icon: 'check_circle' });
            }
            a.close();
          },
        });
        a.el.querySelector('#sf-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') a.el.querySelector('[data-act="save"]').click(); });
      },
    });
  }

  // ---------- Topics ----------
  function topicForm(subjectId, parentId = null) {
    const s = sel.subject(subjectId); if (!s) return;
    const parent = parentId ? sel.node(parentId) : null;
    ui().openSheet({
      title: parent ? `Add to “${U.truncate(parent.title, 36)}”` : `Add to ${s.name}`,
      html: `<div class="field"><label>${parent ? 'Topics' : 'Units / chapters / topics'}</label>
        <textarea class="textarea mono" id="tf-text" rows="7" placeholder="One per line. Indent with 2 spaces to nest:\nChapter 4: Quadratic Equations\n  Factorisation\n  Quadratic formula" autofocus></textarea>
        <div class="hint">Add one or many at once. Lines starting with [x] are added as completed.</div></div>`,
      footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn tint" style="--c:${s.color}" data-act="save">Add</button>`,
      onMount(a) {
        const ta = a.el.querySelector('#tf-text');
        ta.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); a.el.querySelector('[data-act="save"]').click(); }
          if (e.key === 'Tab') { e.preventDefault(); const st = ta.selectionStart; ta.setRangeText('  ', st, ta.selectionEnd, 'end'); }
        });
        onAct(a, {
          save() {
            const tree = TI.outline.parse(ta.value);
            if (!tree.length) { ta.focus(); return; }
            const made = actions.addNodes(subjectId, parentId, tree);
            if (!state.ui.expandedSubjects[subjectId]) actions.setUi({ expandedSubjects: { ...state.ui.expandedSubjects, [subjectId]: 1 } });
            ui().toast(`Added ${U.plural(made.length, 'item')}`, { icon: 'playlist_add_check' });
            a.close();
          },
        });
      },
    });
  }

  // ---------- Pickers ----------
  function subjectPicker({ projectId, title = 'Choose a subject', onPick }) {
    const p = sel.project(projectId) || sel.activeProject();
    const list = p ? sel.subjects(p.id) : [];
    ui().openSheet({
      title,
      html: list.length ? `<div class="list">${list.map((s) => `<div class="list-item click" data-act="pick" data-id="${s.id}" style="--c:${s.color}">
          ${ui().ring(TI.stats.subjectRatio(state, s.id), s.color, { size: 40, stroke: 4, labelSize: 10 })}
          <div class="txt"><div class="ttl">${U.esc(s.name)}</div><div class="sub">${U.fmtDur(TI.stats.subjectTime(state, s.id))} studied</div></div>${U.icon('chevron_right', 'faint')}</div>`).join('')}</div>`
        : ui().empty('menu_book', 'No subjects yet', 'Add a subject to start tracking time.', '<button class="btn primary" data-act="new">Add subject</button>'),
      onMount(a) { onAct(a, { pick(t) { a.close(); onPick(t.dataset.id); }, new() { a.close(); subjectForm(null, p && p.id); } }); },
    });
  }

  function topicPicker({ subjectId, current = null, onPick }) {
    const s = sel.subject(subjectId); if (!s) return;
    const rows = [];
    const walk = (pid, depth) => TI.stats.children(state, subjectId, pid).forEach((n) => {
      const r = TI.stats.nodeRatio(state, n.id);
      rows.push(`<div class="list-item click" data-act="pick" data-id="${n.id}" style="padding-left:${8 + depth * 18}px;--c:${s.color}">
        <span class="check-btn ${r >= 1 ? 'done' : r > 0 ? 'partial' : ''}" style="width:24px;height:24px">${U.icon('check', 'xs')}</span>
        <div class="txt"><div class="ttl" style="font-size:14px">${U.esc(n.title)}</div></div>
        ${n.id === current ? U.icon('radio_button_checked', 'sm') : ''}</div>`);
      walk(n.id, depth + 1);
    });
    walk(null, 0);
    ui().openSheet({
      title: `What are you studying in ${s.name}?`,
      html: `<div class="list-item click" data-act="pick" data-id="" style="--c:${s.color}"><span class="lead">${U.icon('menu_book')}</span><div class="txt"><div class="ttl">Whole subject</div><div class="sub">Don't link the time to a topic</div></div>${!current ? U.icon('radio_button_checked', 'sm') : ''}</div>
        <div class="list">${rows.join('') || '<div class="tree-empty">No topics yet.</div>'}</div>`,
      onMount(a) { onAct(a, { pick(t) { a.close(); onPick(t.dataset.id || null); } }); },
    });
  }

  // ---------- Manual time ----------
  function logTimeForm({ subjectId = null, day = U.today() } = {}) {
    const p = sel.activeProject();
    const subjects = p ? sel.subjects(p.id) : [];
    if (!subjects.length) { ui().toast('Add a subject first', { icon: 'info' }); return; }
    let sid = subjectId || subjects[0].id;
    const topicOptions = (id) => ['<option value="">Whole subject</option>', ...TI.stats.leaves(state, id).map((l) => `<option value="${l.node.id}">${U.esc([...l.path, l.node.title].join(' › '))}</option>`)].join('');
    const nowHm = U.minToHm(Math.max(0, new Date().getHours() * 60 + new Date().getMinutes() - 30));
    ui().openSheet({
      title: 'Log study time',
      html: `<div class="field"><label>Subject</label><select class="select" id="lt-subject">${subjects.map((s) => `<option value="${s.id}" ${s.id === sid ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Topic</label><select class="select" id="lt-topic">${topicOptions(sid)}</select></div>
        <div class="field-row"><div class="field"><label>Date</label><input class="input" type="date" id="lt-date" value="${day}" max="${U.today()}" /></div>
        <div class="field"><label>Start time</label><input class="input" type="time" id="lt-time" value="${nowHm}" /></div></div>
        <div class="field"><label>Duration</label><div class="row"><input class="input" type="number" id="lt-h" min="0" max="16" value="0" style="width:90px" /><span class="muted">h</span><input class="input" type="number" id="lt-m" min="0" max="59" value="30" style="width:90px" /><span class="muted">min</span></div>
          <div class="chips" style="margin-top:8px">${[15, 25, 30, 45, 60, 90, 120].map((m) => `<button class="chip" data-act="quick" data-m="${m}">${U.fmtMin(m)}</button>`).join('')}</div></div>`,
      footer: '<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-act="save">Save</button>',
      onMount(a) {
        const $ = (id) => a.el.querySelector(id);
        $('#lt-subject').addEventListener('change', (e) => { sid = e.target.value; $('#lt-topic').innerHTML = topicOptions(sid); });
        onAct(a, {
          quick(t) { const m = +t.dataset.m; $('#lt-h').value = Math.floor(m / 60); $('#lt-m').value = m % 60; },
          save() {
            const dur = (+$('#lt-h').value || 0) * 3600 + (+$('#lt-m').value || 0) * 60;
            if (dur < 60) { ui().toast('Enter at least 1 minute', { icon: 'info' }); return; }
            const [y, mo, d] = $('#lt-date').value.split('-').map(Number); const [hh, mm] = ($('#lt-time').value || '09:00').split(':').map(Number);
            const start = new Date(y, mo - 1, d, hh, mm).getTime();
            actions.logSession({ subjectId: sid, nodeId: $('#lt-topic').value || null, start, duration: dur, mode: 'manual', manual: true });
            ui().toast(`Logged ${U.fmtDur(dur, { short: true })}`, { icon: 'check_circle' });
            a.close();
          },
        });
      },
    });
  }

  // ---------- Day details ----------
  function dayDetails(day, projectId) {
    const draw = () => {
      const list = sel.sessionsOn(day, projectId);
      const total = U.sum(list, (s) => s.duration);
      return `<div class="row between" style="margin-bottom:6px"><div><div class="stat-label">Total</div><div style="font-size:24px;font-weight:600">${U.fmtDur(total)}</div></div>
          <button class="btn sm" data-act="log">${U.icon('add')}Log time</button></div>
        ${list.length ? `<div class="list">${list.map((s) => {
          const subj = sel.subject(s.subjectId); const node = s.nodeId ? sel.node(s.nodeId) : null;
          return `<div class="list-item" style="--c:${subj ? subj.color : 'var(--primary)'}"><span class="lead">${U.icon(s.manual ? 'edit_calendar' : s.mode === 'stopwatch' ? 'timer' : 'nest_clock_farsight_analog')}</span>
            <div class="txt"><div class="ttl">${U.esc(subj ? subj.name : 'Deleted subject')}</div><div class="sub">${U.fmtTime(s.start, state.settings.h12)} · ${node ? U.esc(node.title) : s.manual ? 'Logged manually' : s.mode}</div></div>
            <span class="trail">${U.fmtDur(s.duration, { short: true })}</span><button class="icon-btn sm muted" data-act="del" data-id="${s.id}" aria-label="Delete session">${U.icon('delete')}</button></div>`;
        }).join('')}</div>` : ui().empty('hourglass_empty', 'No study time logged', 'Start a timer or log time you studied away from the app.')}`;
    };
    const unsub = TI.store.subscribe(() => { if (api.body) api.setBody(draw()); });
    const api = ui().openSheet({
      title: U.fmtDay(day), html: draw(), onClose: () => unsub(),
      onMount(a) {
        onAct(a, {
          log() { logTimeForm({ day }); },
          async del(t) { if (await ui().confirmDialog('Delete this session?', 'The time will be removed from your stats.')) actions.deleteSession(t.dataset.id); },
        });
      },
    });
  }

  // ---------- Month calendar ----------
  function calendarSheet(projectId) {
    let y = new Date().getFullYear(); let m = new Date().getMonth();
    const fn = (d) => (projectId ? TI.stats.projectDay(state, projectId, d) : TI.stats.allDay(state, d));
    const draw = () => {
      const first = new Date(y, m, 1); const days = new Date(y, m + 1, 0).getDate();
      let total = 0; let active = 0;
      for (let i = 1; i <= days; i++) { const s = fn(U.dayKey(new Date(y, m, i))); total += s; if (s) active++; }
      return `<div class="row between" style="margin-bottom:12px"><button class="icon-btn" data-act="prev" aria-label="Previous month">${U.icon('chevron_left')}</button>
        <div class="center"><div style="font-weight:600">${U.MONTHS_LONG[m]} ${y}</div><div class="small muted">${U.fmtDur(total)} · ${active} active days</div></div>
        <button class="icon-btn" data-act="next" aria-label="Next month" ${first > new Date() || (y === new Date().getFullYear() && m === new Date().getMonth()) ? 'disabled style="opacity:.3"' : ''}>${U.icon('chevron_right')}</button></div>
        ${TI.charts.monthGrid({ year: y, month: m, fn, weekStart: state.settings.weekStart })}`;
    };
    ui().openSheet({
      title: 'Calendar', html: draw(),
      onMount(a) {
        onAct(a, {
          prev() { m--; if (m < 0) { m = 11; y--; } a.setBody(draw()); },
          next() { const now = new Date(); if (y === now.getFullYear() && m === now.getMonth()) return; m++; if (m > 11) { m = 0; y++; } a.setBody(draw()); },
          'cal-day'(t) { if (t.dataset.day <= U.today()) dayDetails(t.dataset.day, projectId); },
        });
      },
    });
  }

  // ---------- Project switcher menu ----------
  function projectMenu(anchor) {
    const cur = sel.activeProject();
    const items = [{ heading: 'Exams & projects' }, ...sel.projects().map((p) => ({ label: p.name, dot: p.color, on: cur && p.id === cur.id, trail: U.pctInt(TI.stats.projectRatio(state, p.id)), onClick: () => { actions.setActiveProject(p.id); TI.router.go('/project'); } }))];
    items.push({ sep: true });
    items.push({ icon: 'add', label: 'Add exam / project', onClick: () => TI.router.go('/templates') });
    items.push({ icon: 'grid_view', label: 'All projects (Dashboard)', onClick: () => TI.router.go('/') });
    items.push({ icon: 'tune', label: 'Manage projects', onClick: () => TI.router.go('/projects') });
    ui().openMenu(anchor, items, { align: 'left' });
  }

  TI.forms = { onAct, projectForm, subjectForm, topicForm, subjectPicker, topicPicker, logTimeForm, dayDetails, calendarSheet, projectMenu };
})(window.TI);
